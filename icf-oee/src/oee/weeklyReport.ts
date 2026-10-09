import { formatDateTime, formatPercent } from './oeeFormat';
import { siteOeeLevel } from './oeeKpi';
import { COMPANY_NAME, DAY_MS, OEE_ALERT_THRESHOLD } from './types';
import type { Site, SiteUnit, UnitOeeStats } from './types';

/** A weekly report covers 7 whole UTC days. */
export const REPORT_DAYS = 7;
const REPORT_HOURS = REPORT_DAYS * 24;
/** How many unit types and units the report lists. */
export const REPORT_TOP_COUNT = 10;

export type ReportPeriod = {
  /** Start of the first day, in milliseconds since epoch (UTC). */
  startMs: number;
  /** Start of the day after the last day: the period ends just before. */
  endMs: number;
  /** First and last day, "YYYY-MM-DD" in UTC, both included. */
  from: string;
  to: string;
};

/** The 7 UTC days that end on `lastDay` ("YYYY-MM-DD", included), or null when it is not a day. */
export function reportPeriod(lastDay: string | null): ReportPeriod | null {
  if (lastDay === null || !/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) return null;
  const lastDayMs = Date.parse(`${lastDay}T00:00:00Z`);
  if (Number.isNaN(lastDayMs)) return null;
  return toPeriod(lastDayMs - (REPORT_DAYS - 1) * DAY_MS);
}

/** The 7 days just before a period: what the report compares it with. */
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  return toPeriod(period.startMs - REPORT_DAYS * DAY_MS);
}

function toPeriod(startMs: number): ReportPeriod {
  const endMs = startMs + REPORT_DAYS * DAY_MS;
  return { startMs, endMs, from: toDay(startMs), to: toDay(endMs - DAY_MS) };
}

function toDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** What a group of units did over the week, and how that compares with the week before. */
export type ReportFigures = {
  /** Mean OEE over every hourly average of the week. */
  meanOee: number | null;
  /** Share of the hourly averages below the alert threshold, from 0 to 1. */
  belowAlertShare: number | null;
  previousMeanOee: number | null;
  /** Mean OEE of the week minus the mean OEE of the week before; null when one is missing. */
  change: number | null;
};

export type ReportSiteRow = {
  site: Site;
  unitCount: number;
  figures: ReportFigures;
  /** The unit of the site with the lowest mean OEE over the week. */
  lowestUnit: { externalId: string; name: string; meanOee: number } | null;
};

export type ReportTypeRow = {
  name: string;
  unitCount: number;
  figures: ReportFigures;
};

export type ReportUnitRow = {
  site: Site;
  unit: { externalId: string; name: string };
  figures: ReportFigures;
};

export type WeeklyReport = {
  period: ReportPeriod;
  /** "All sites" or the name of the site. */
  scope: string;
  unitCount: number;
  /** Units that have at least one hourly average in the week. */
  unitsWithData: number;
  /** Units whose mean OEE over the week is below the alert threshold. */
  unitsBelowAlert: number;
  /** Share of the hours of the week that have an OEE value, over all the units; null without unit. */
  coverage: number | null;
  overall: ReportFigures;
  /** Lowest mean OEE first. */
  sites: ReportSiteRow[];
  /** The unit types that spent the most time below the alert threshold, highest first. */
  unitTypes: ReportTypeRow[];
  /** The units with the lowest mean OEE, lowest first. */
  units: ReportUnitRow[];
};

type ReportInput = {
  /** The units of the scope. */
  units: SiteUnit[];
  current: UnitOeeStats[];
  previous: UnitOeeStats[];
  period: ReportPeriod;
  scope: string;
};

export function buildWeeklyReport({ units, current, previous, period, scope }: ReportInput): WeeklyReport {
  const currentByUnit = new Map(current.map((stats) => [stats.externalId, stats]));
  const previousByUnit = new Map(previous.map((stats) => [stats.externalId, stats]));
  const figuresOf = (group: SiteUnit[]): ReportFigures => {
    const now = pool(group.map(({ unit }) => currentByUnit.get(unit.externalId)));
    const before = pool(group.map(({ unit }) => previousByUnit.get(unit.externalId)));
    return {
      meanOee: now.meanOee,
      belowAlertShare: now.periods === 0 ? null : now.periodsBelowAlert / now.periods,
      previousMeanOee: before.meanOee,
      change: now.meanOee === null || before.meanOee === null ? null : now.meanOee - before.meanOee,
    };
  };

  const unitRows: ReportUnitRow[] = units.map((siteUnit) => ({
    site: siteUnit.site,
    unit: { externalId: siteUnit.unit.externalId, name: siteUnit.unit.name },
    figures: figuresOf([siteUnit]),
  }));
  const withData = unitRows.filter((row) => row.figures.meanOee !== null);

  const siteRows = groupBy(units, ({ site }) => site.externalId).map((group): ReportSiteRow => {
    const lowest = withData
      .filter((row) => row.site.externalId === group[0].site.externalId)
      .sort(byLowestMean)[0];
    return {
      site: group[0].site,
      unitCount: group.length,
      figures: figuresOf(group),
      lowestUnit:
        lowest === undefined || lowest.figures.meanOee === null
          ? null
          : { externalId: lowest.unit.externalId, name: lowest.unit.name, meanOee: lowest.figures.meanOee },
    };
  });

  const typeRows = groupBy(units, ({ unit }) => unit.name).map(
    (group): ReportTypeRow => ({ name: group[0].unit.name, unitCount: group.length, figures: figuresOf(group) })
  );

  return {
    period,
    scope,
    unitCount: units.length,
    unitsWithData: withData.length,
    unitsBelowAlert: withData.filter((row) => (row.figures.meanOee ?? 1) < OEE_ALERT_THRESHOLD).length,
    coverage:
      units.length === 0
        ? null
        : pool(units.map(({ unit }) => currentByUnit.get(unit.externalId))).periods / (units.length * REPORT_HOURS),
    overall: figuresOf(units),
    sites: siteRows.sort((a, b) => byLowestMean(a, b) || a.site.name.localeCompare(b.site.name)),
    unitTypes: typeRows
      .filter((row) => row.figures.belowAlertShare !== null)
      .sort(
        (a, b) =>
          (b.figures.belowAlertShare ?? 0) - (a.figures.belowAlertShare ?? 0) ||
          byLowestMean(a, b) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, REPORT_TOP_COUNT),
    units: withData
      .sort(
        (a, b) =>
          byLowestMean(a, b) ||
          a.site.name.localeCompare(b.site.name) ||
          a.unit.externalId.localeCompare(b.unit.externalId)
      )
      .slice(0, REPORT_TOP_COUNT),
  };
}

/** Mean OEE and period counts over every hourly average of the given units. */
function pool(group: (UnitOeeStats | undefined)[]): { meanOee: number | null; periods: number; periodsBelowAlert: number } {
  let total = 0;
  let periods = 0;
  let periodsBelowAlert = 0;
  for (const stats of group) {
    if (stats === undefined || stats.meanOee === null) continue;
    total += stats.meanOee * stats.periods;
    periods += stats.periods;
    periodsBelowAlert += stats.periodsBelowAlert;
  }
  return { meanOee: periods === 0 ? null : total / periods, periods, periodsBelowAlert };
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return [...groups.values()];
}

function byLowestMean(a: { figures: ReportFigures }, b: { figures: ReportFigures }): number {
  return (a.figures.meanOee ?? Number.POSITIVE_INFINITY) - (b.figures.meanOee ?? Number.POSITIVE_INFINITY);
}

/** 0.031 → "+3.1 pts", -0.02 → "-2.0 pts": a difference between two percentages. */
export function formatChange(change: number | null): string {
  if (change === null || !Number.isFinite(change)) return '–';
  const points = change * 100;
  // Avoid "-0.0": a change that rounds to zero has no sign.
  const rounded = Math.abs(points) < 0.05 ? 0 : points;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} pts`;
}

export function reportFileName(report: WeeklyReport): string {
  const scope = report.scope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `icf-oee_weekly-report_${scope}_${report.period.from}_${report.period.to}.html`;
}

/**
 * The report as one HTML file that needs nothing else: it opens in any browser, can be sent by
 * e-mail, and prints on paper or to a PDF file.
 */
export function buildReportHtml(report: WeeklyReport, generatedAt: number): string {
  const { period, overall } = report;
  const previous = previousPeriod(period);
  const title = `Weekly OEE report – ${report.scope} – ${period.from} to ${period.to}`;

  const summary = table(
    ['Figure', 'This week', 'Week before', 'Change'],
    [
      [
        cell('Mean OEE'),
        siteOeeCell(overall.meanOee),
        percentCell(overall.previousMeanOee),
        cell(formatChange(overall.change)),
      ],
      [cell('Time below 70% OEE'), percentCell(overall.belowAlertShare), cell('–'), cell('–')],
      [cell('Units below 70% (mean OEE of the week)'), cell(String(report.unitsBelowAlert)), cell('–'), cell('–')],
      [cell('Units with OEE values'), cell(`${report.unitsWithData} of ${report.unitCount}`), cell('–'), cell('–')],
      [cell('Hours of the week with OEE values'), percentCell(report.coverage), cell('–'), cell('–')],
    ]
  );

  const sites = table(
    ['Site', 'Units', 'Mean OEE', 'Week before', 'Change', 'Time below 70%', 'Lowest unit'],
    report.sites.map((row) => [
      cell(row.site.name),
      cell(String(row.unitCount)),
      siteOeeCell(row.figures.meanOee),
      percentCell(row.figures.previousMeanOee),
      cell(formatChange(row.figures.change)),
      percentCell(row.figures.belowAlertShare),
      cell(row.lowestUnit === null ? '–' : `${row.lowestUnit.name} (${formatPercent(row.lowestUnit.meanOee)})`),
    ])
  );

  const unitTypes = table(
    ['Unit type', 'Units', 'Time below 70%', 'Mean OEE', 'Week before', 'Change'],
    report.unitTypes.map((row) => [
      cell(row.name),
      cell(String(row.unitCount)),
      percentCell(row.figures.belowAlertShare),
      oeeCell(row.figures.meanOee),
      percentCell(row.figures.previousMeanOee),
      cell(formatChange(row.figures.change)),
    ])
  );

  const units = table(
    ['Site', 'Unit', 'External ID', 'Mean OEE', 'Week before', 'Change', 'Time below 70%'],
    report.units.map((row) => [
      cell(row.site.name),
      cell(row.unit.name),
      cell(row.unit.externalId),
      oeeCell(row.figures.meanOee),
      percentCell(row.figures.previousMeanOee),
      cell(formatChange(row.figures.change)),
      percentCell(row.figures.belowAlertShare),
    ])
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: black; margin: 2rem; line-height: 1.4; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 0.5rem; }
  p { margin: 0.25rem 0; }
  .note { color: dimgray; font-size: 0.9rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  th, td { border-bottom: 1px solid lightgray; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
  th { border-bottom: 2px solid gray; }
  .alert { color: firebrick; font-weight: 700; }
  @media print { body { margin: 1cm; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Weekly OEE report</h1>
<p><strong>${escapeHtml(COMPANY_NAME)}</strong> – ${escapeHtml(report.scope)}</p>
<p>Week from ${period.from} to ${period.to} (UTC, both days included), compared with ${previous.from} to ${previous.to}.</p>
<p class="note">OEE = quality × performance × availability. Mean of the hourly averages of the units.
In bold red: the mean OEE of a site or of the whole selection below 80%, and the mean OEE of a unit
or of a unit type below the 70% alert threshold. Generated on ${escapeHtml(formatDateTime(generatedAt))}.</p>
<h2>Summary</h2>
${summary}
<h2>Sites, lowest mean OEE first</h2>
${sites}
<h2>The ${report.unitTypes.length} unit types with the most time below 70%</h2>
${unitTypes}
<h2>The ${report.units.length} units with the lowest mean OEE</h2>
${units}
</body>
</html>
`;
}

/** A table cell, already escaped. */
type Cell = { html: string };

function cell(text: string): Cell {
  return { html: `<td>${escapeHtml(text)}</td>` };
}

function percentCell(ratio: number | null): Cell {
  return cell(formatPercent(ratio));
}

/** An OEE value: marked when it is below the alert threshold. */
function oeeCell(ratio: number | null): Cell {
  if (ratio !== null && ratio < OEE_ALERT_THRESHOLD) {
    return { html: `<td class="alert">${escapeHtml(formatPercent(ratio))} (below 70%)</td>` };
  }
  return percentCell(ratio);
}

/** The OEE of a whole site, or of the whole selection: marked when it is below 80%. */
function siteOeeCell(ratio: number | null): Cell {
  if (siteOeeLevel(ratio) === 'critical') {
    return { html: `<td class="alert">${escapeHtml(formatPercent(ratio))} (below 80%)</td>` };
  }
  return percentCell(ratio);
}

function table(headers: string[], rows: Cell[][]): string {
  const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
  const body =
    rows.length === 0
      ? `<tr><td colspan="${headers.length}">No value in this week.</td></tr>`
      : rows.map((row) => `<tr>${row.map((item) => item.html).join('')}</tr>`).join('\n');
  return `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/** Names come from the project data: they must not be read as HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
