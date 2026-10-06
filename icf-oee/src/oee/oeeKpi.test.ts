import { describe, expect, it } from 'vitest';

import { oeeLevel, summarizeSite } from './oeeKpi';
import type { UnitOee } from './types';

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

function makeUnit(externalId: string, oee: number | null): UnitOee {
  return { externalId, name: `Unit ${externalId}`, oee, quality: null, performance: null, availability: null, updatedAt: null };
}
