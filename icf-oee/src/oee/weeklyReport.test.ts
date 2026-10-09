import { describe, expect, it } from 'vitest';

import type { SiteUnit, UnitOeeStats } from './types';
import {
  buildReportHtml,
  buildWeeklyReport,
  escapeHtml,
  formatChange,
  previousPeriod,
  reportFileName,
  reportPeriod,
} from './weeklyReport';
import type { ReportPeriod } from './weeklyReport';

const DAY = 24 * 60 * 60 * 1000;
const PERIOD: ReportPeriod = {
  startMs: Date.UTC(2026, 8, 28),
  endMs: Date.UTC(2026, 9, 5),
  from: '2026-09-28',
  to: '2026-10-04',
};

const OSLO = { externalId: 'oslo', name: 'Oslo' };
const HOUSTON = { externalId: 'houston', name: 'Houston' };

const UNITS: SiteUnit[] = [
  makeUnit(OSLO, 'O-MIX', 'Mixer'),
  makeUnit(OSLO, 'O-TANK', 'Tank'),
  makeUnit(HOUSTON, 'H-MIX', 'Mixer'),
  makeUnit(HOUSTON, 'H-TANK', 'Tank'),
  makeUnit(HOUSTON, 'H-IDLE', 'Idle line'),
];

/** This week: the mixers are low, the Houston tank is the best unit; the idle line has no value. */
const CURRENT: UnitOeeStats[] = [
  { externalId: 'O-MIX', meanOee: 0.5, periods: 100, periodsBelowAlert: 80 },
  { externalId: 'O-TANK', meanOee: 0.9, periods: 100, periodsBelowAlert: 0 },
  { externalId: 'H-MIX', meanOee: 0.6, periods: 50, periodsBelowAlert: 30 },
  { externalId: 'H-TANK', meanOee: 0.95, periods: 100, periodsBelowAlert: 10 },
  { externalId: 'H-IDLE', meanOee: null, periods: 0, periodsBelowAlert: 0 },
];

/** The week before: only the Oslo units have values. */
const PREVIOUS: UnitOeeStats[] = [
  { externalId: 'O-MIX', meanOee: 0.6, periods: 100, periodsBelowAlert: 60 },
  { externalId: 'O-TANK', meanOee: 0.8, periods: 100, periodsBelowAlert: 5 },
];

describe(reportPeriod.name, () => {
  it('is the 7 UTC days that end on the last day, included', () => {
    expect(reportPeriod('2026-10-04')).toEqual(PERIOD);
  });

  it('is null when the last day is missing or is not a day', () => {
    expect(reportPeriod(null)).toBeNull();
    expect(reportPeriod('04/10/2026')).toBeNull();
    expect(reportPeriod('2026-13-45')).toBeNull();
  });
});

describe(previousPeriod.name, () => {
  it('is the 7 days just before', () => {
    expect(previousPeriod(PERIOD)).toEqual({
      startMs: PERIOD.startMs - 7 * DAY,
      endMs: PERIOD.startMs,
      from: '2026-09-21',
      to: '2026-09-27',
    });
  });
});

describe(buildWeeklyReport.name, () => {
  const report = buildWeeklyReport({ units: UNITS, current: CURRENT, previous: PREVIOUS, period: PERIOD, scope: 'All sites' });

  it('counts the units, the ones with values and the ones below the alert threshold', () => {
    expect(report.unitCount).toBe(5);
    expect(report.unitsWithData).toBe(4);
    expect(report.unitsBelowAlert).toBe(2);
    // 350 hourly averages out of 5 units × 168 hours.
    expect(report.coverage).toBeCloseTo(350 / 840);
    expect(report.scope).toBe('All sites');
    expect(report.period).toEqual(PERIOD);
  });

  it('pools every hourly average of the units for the overall figures', () => {
    // (0.5×100 + 0.9×100 + 0.6×50 + 0.95×100) / 350
    expect(report.overall.meanOee).toBeCloseTo(265 / 350);
    expect(report.overall.belowAlertShare).toBeCloseTo(120 / 350);
    expect(report.overall.previousMeanOee).toBeCloseTo(0.7);
    expect(report.overall.change).toBeCloseTo(265 / 350 - 0.7);
  });

  it('lists the sites, lowest mean OEE first, with their lowest unit', () => {
    expect(report.sites.map((row) => row.site.name)).toEqual(['Oslo', 'Houston']);
    const [oslo, houston] = report.sites;
    expect(oslo.unitCount).toBe(2);
    expect(oslo.figures.meanOee).toBeCloseTo(0.7);
    expect(oslo.figures.change).toBeCloseTo(0);
    expect(oslo.lowestUnit).toEqual({ externalId: 'O-MIX', name: 'Mixer', meanOee: 0.5 });
    expect(houston.unitCount).toBe(3);
    expect(houston.figures.meanOee).toBeCloseTo((0.6 * 50 + 0.95 * 100) / 150);
    expect(houston.lowestUnit?.externalId).toBe('H-MIX');
  });

  it('has no change for a group without value in the week before', () => {
    const houston = report.sites[1];
    expect(houston.figures.previousMeanOee).toBeNull();
    expect(houston.figures.change).toBeNull();
  });

  it('ranks the unit types by time below the alert threshold and leaves out the ones without value', () => {
    expect(report.unitTypes.map((row) => row.name)).toEqual(['Mixer', 'Tank']);
    expect(report.unitTypes[0].unitCount).toBe(2);
    expect(report.unitTypes[0].figures.belowAlertShare).toBeCloseTo(110 / 150);
    expect(report.unitTypes[1].figures.belowAlertShare).toBeCloseTo(10 / 200);
  });

  it('lists the units with the lowest mean OEE first, without the ones that have no value', () => {
    expect(report.units.map((row) => row.unit.externalId)).toEqual(['O-MIX', 'H-MIX', 'O-TANK', 'H-TANK']);
    expect(report.units[0].site).toEqual(OSLO);
  });

  it('keeps at most 10 unit types and 10 units', () => {
    const many: SiteUnit[] = Array.from({ length: 12 }, (_, index) => makeUnit(OSLO, `U${index}`, `Type ${index}`));
    const stats: UnitOeeStats[] = many.map(({ unit }, index) => ({
      externalId: unit.externalId,
      meanOee: 0.5 + index * 0.01,
      periods: 10,
      periodsBelowAlert: 10 - (index % 10),
    }));

    const large = buildWeeklyReport({ units: many, current: stats, previous: [], period: PERIOD, scope: 'Oslo' });

    expect(large.unitTypes).toHaveLength(10);
    expect(large.units).toHaveLength(10);
    expect(large.units[0].unit.externalId).toBe('U0');
  });

  it('is empty for a scope without unit', () => {
    const empty = buildWeeklyReport({ units: [], current: [], previous: [], period: PERIOD, scope: 'Oslo' });

    expect(empty.unitCount).toBe(0);
    expect(empty.unitsWithData).toBe(0);
    expect(empty.coverage).toBeNull();
    expect(empty.overall).toEqual({ meanOee: null, belowAlertShare: null, previousMeanOee: null, change: null });
    expect(empty.sites).toEqual([]);
  });
});

describe(formatChange.name, () => {
  it('shows a difference between two percentages in points, with its sign', () => {
    expect(formatChange(0.031)).toBe('+3.1 pts');
    expect(formatChange(-0.02)).toBe('-2.0 pts');
  });

  it('shows a change that rounds to zero without sign', () => {
    expect(formatChange(0)).toBe('0.0 pts');
    expect(formatChange(-0.0001)).toBe('0.0 pts');
  });

  it('shows a dash without value', () => {
    expect(formatChange(null)).toBe('–');
    expect(formatChange(Number.NaN)).toBe('–');
  });
});

describe(reportFileName.name, () => {
  it('names the file after the scope and the week', () => {
    const report = buildWeeklyReport({ units: UNITS, current: CURRENT, previous: PREVIOUS, period: PERIOD, scope: 'Kuala Lumpur' });

    expect(reportFileName(report)).toBe('icf-oee_weekly-report_kuala-lumpur_2026-09-28_2026-10-04.html');
  });
});

describe(escapeHtml.name, () => {
  it('escapes the characters that HTML would interpret', () => {
    expect(escapeHtml('<b>Tom & "Jerry\'s"</b>')).toBe('&lt;b&gt;Tom &amp; &quot;Jerry&#39;s&quot;&lt;/b&gt;');
  });
});

describe(buildReportHtml.name, () => {
  const report = buildWeeklyReport({ units: UNITS, current: CURRENT, previous: PREVIOUS, period: PERIOD, scope: 'All sites' });
  const html = buildReportHtml(report, Date.UTC(2026, 9, 5, 8, 30));

  it('is one complete HTML document that loads nothing from elsewhere', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Weekly OEE report – All sites – 2026-09-28 to 2026-10-04</title>');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<script');
  });

  it('says which week it covers, which week it is compared with and when it was made', () => {
    expect(html).toContain('Week from 2026-09-28 to 2026-10-04');
    expect(html).toContain('compared with 2026-09-21 to 2026-09-27');
    expect(html).toContain('Generated on 2026-10-05 08:30 UTC');
    expect(html).toContain('Full Icecreamergies');
  });

  it('has the summary, the sites, the unit types and the units', () => {
    expect(html).toContain('<h2>Summary</h2>');
    expect(html).toContain('<td>75.7%</td><td>70.0%</td><td>+5.7 pts</td>');
    expect(html).toContain('<td>4 of 5</td>');
    expect(html).toContain('<td>Hours of the week with OEE values</td><td>41.7%</td>');
    expect(html).toContain('<h2>Sites, lowest mean OEE first</h2>');
    expect(html).toContain('<td>Mixer (50.0%)</td>');
    expect(html).toContain('<h2>The 2 unit types with the most time below 70%</h2>');
    expect(html).toContain('<h2>The 4 units with the lowest mean OEE</h2>');
    expect(html).toContain('<td>O-MIX</td>');
  });

  it('marks an OEE below the alert threshold in text and not only in colour', () => {
    expect(html).toContain('<td class="alert">50.0% (below 70%)</td>');
    expect(html).not.toContain('<td class="alert">90.0%');
  });

  it('escapes the names of the project data', () => {
    const risky = buildWeeklyReport({
      units: [makeUnit({ externalId: 's', name: 'A <b>site</b>' }, 'U', 'Tank & <script>alert(1)</script>')],
      current: [{ externalId: 'U', meanOee: 0.9, periods: 10, periodsBelowAlert: 0 }],
      previous: [],
      period: PERIOD,
      scope: 'A <b>site</b>',
    });

    const riskyHtml = buildReportHtml(risky, 0);

    expect(riskyHtml).not.toContain('<script>alert(1)</script>');
    expect(riskyHtml).toContain('Tank &amp; &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(riskyHtml).toContain('A &lt;b&gt;site&lt;/b&gt;');
  });

  it('says so when a table has no row', () => {
    const empty = buildWeeklyReport({ units: [], current: [], previous: [], period: PERIOD, scope: 'Oslo' });

    expect(buildReportHtml(empty, 0)).toContain('No value in this week.');
  });
});

function makeUnit(site: { externalId: string; name: string }, externalId: string, name: string): SiteUnit {
  return {
    site,
    unit: { externalId, name, oee: null, quality: null, performance: null, availability: null, updatedAt: null },
  };
}
