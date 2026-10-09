import { describe, expect, it } from 'vitest';

import { lowestUnits, oeeLevel, siteMapLevel, summarizeSite } from './oeeKpi';
import type { UnitOee } from './types';

describe(siteMapLevel.name, () => {
  it('is critical (red) below 80%', () => {
    expect(siteMapLevel(0)).toBe('critical');
    expect(siteMapLevel(0.799)).toBe('critical');
  });

  it('is a warning (orange) from 80% to below 90%', () => {
    expect(siteMapLevel(0.8)).toBe('warning');
    expect(siteMapLevel(0.899)).toBe('warning');
  });

  it('is good (green) from 90%', () => {
    expect(siteMapLevel(0.9)).toBe('good');
    expect(siteMapLevel(1)).toBe('good');
  });

  it('is unknown without a value', () => {
    expect(siteMapLevel(null)).toBe('unknown');
    expect(siteMapLevel(undefined)).toBe('unknown');
    expect(siteMapLevel(Number.NaN)).toBe('unknown');
  });
});

describe(oeeLevel.name, () => {
  it('is critical below 70%', () => {
    expect(oeeLevel(0)).toBe('critical');
    expect(oeeLevel(0.699)).toBe('critical');
  });

  it('is a warning from 70% to below 85%', () => {
    expect(oeeLevel(0.7)).toBe('warning');
    expect(oeeLevel(0.849)).toBe('warning');
  });

  it('is good from 85%', () => {
    expect(oeeLevel(0.85)).toBe('good');
    expect(oeeLevel(1)).toBe('good');
  });

  it('is unknown without a value', () => {
    expect(oeeLevel(null)).toBe('unknown');
    expect(oeeLevel(undefined)).toBe('unknown');
    expect(oeeLevel(Number.NaN)).toBe('unknown');
  });
});

describe(summarizeSite.name, () => {
  it('returns an empty summary for a site without units', () => {
    expect(summarizeSite([])).toEqual({ unitCount: 0, meanOee: null, belowAlertCount: 0, lowestUnit: null });
  });

  it('computes the mean, the units below the alert threshold and the lowest unit', () => {
    const units = [makeUnit('A', 0.9), makeUnit('B', 0.5), makeUnit('C', 0.1)];

    const summary = summarizeSite(units);

    expect(summary.unitCount).toBe(3);
    expect(summary.meanOee).toBeCloseTo(0.5);
    expect(summary.belowAlertCount).toBe(2);
    expect(summary.lowestUnit).toBe(units[2]);
  });

  it('counts the units without OEE value but leaves them out of the figures', () => {
    const summary = summarizeSite([makeUnit('A', 0.8), makeUnit('B', null)]);

    expect(summary).toEqual({
      unitCount: 2,
      meanOee: 0.8,
      belowAlertCount: 0,
      lowestUnit: makeUnit('A', 0.8),
    });
  });
});

describe(lowestUnits.name, () => {
  it('returns the units with the lowest OEE, lowest first', () => {
    const units = [makeUnit('A', 0.9), makeUnit('B', 0.5), makeUnit('C', 0.1), makeUnit('D', 0.7)];

    expect(lowestUnits(units, 3).map((unit) => unit.externalId)).toEqual(['C', 'B', 'D']);
  });

  it('leaves out the units without OEE value and does not change the input', () => {
    const units = [makeUnit('A', 0.9), makeUnit('B', null), makeUnit('C', 0.1)];

    expect(lowestUnits(units, 3).map((unit) => unit.externalId)).toEqual(['C', 'A']);
    expect(units.map((unit) => unit.externalId)).toEqual(['A', 'B', 'C']);
  });
});

function makeUnit(externalId: string, oee: number | null): UnitOee {
  return { externalId, name: `Unit ${externalId}`, oee, quality: null, performance: null, availability: null, updatedAt: null };
}
