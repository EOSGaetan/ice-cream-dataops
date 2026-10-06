import { describe, expect, it } from 'vitest';

import { formatDateTime, formatPercent, summarizeTrend } from './oeeFormat';

describe(formatPercent.name, () => {
  it('formats a ratio as a percentage with one decimal', () => {
    expect(formatPercent(0.7717703845549893)).toBe('77.2%');
    expect(formatPercent(1)).toBe('100.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('shows a dash when there is no value', () => {
    expect(formatPercent(null)).toBe('–');
    expect(formatPercent(undefined)).toBe('–');
    expect(formatPercent(Number.NaN)).toBe('–');
  });
});

describe(formatDateTime.name, () => {
  it('formats a timestamp in UTC', () => {
    expect(formatDateTime(Date.UTC(2026, 9, 4, 12, 10))).toBe('2026-10-04 12:10 UTC');
  });

  it('shows a dash when there is no timestamp', () => {
    expect(formatDateTime(null)).toBe('–');
    expect(formatDateTime(undefined)).toBe('–');
  });
});

describe(summarizeTrend.name, () => {
  it('returns null for an empty trend', () => {
    expect(summarizeTrend([])).toBeNull();
  });

  it('computes mean, minimum, maximum, period and the points below the alert threshold', () => {
    const summary = summarizeTrend([
      { timestamp: 1000, oee: 0.5 },
      { timestamp: 2000, oee: 1 },
      { timestamp: 3000, oee: 0 },
    ]);

    expect(summary).toEqual({ mean: 0.5, min: 0, max: 1, start: 1000, end: 3000, belowAlert: 2, count: 3 });
  });
});
