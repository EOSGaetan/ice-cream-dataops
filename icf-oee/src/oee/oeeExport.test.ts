import { describe, expect, it } from 'vitest';

import {
  buildCsv,
  exportFileName,
  formatUtcDay,
  getCsvFormat,
  getExportStep,
  isCsvFormatId,
  isExportStepId,
  parseUtcDay,
  planExport,
} from './oeeExport';
import type { ExportSeries, ExportUnit } from './oeeExport';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const START = Date.UTC(2026, 9, 5);

describe(planExport.name, () => {
  it('sizes a small export in one request', () => {
    expect(planExport(2, 4, START, START + DAY, HOUR)).toEqual({
      points: 24,
      rows: 48,
      pointsPerWindow: 24,
      windows: 1,
      seriesPerRequest: 100,
      requests: 1,
    });
  });

  it('limits a request to 10 000 averages', () => {
    // A week of hourly averages: 168 per time series, so 59 time series per request.
    const plan = planExport(628, 4, START, START + 7 * DAY, HOUR);

    expect(plan.points).toBe(168);
    expect(plan.seriesPerRequest).toBe(59);
    expect(plan.requests).toBe(43);
    expect(plan.rows).toBe(105504);
  });

  it('cuts a long period in windows when one time series exceeds 10 000 averages', () => {
    // A week at 1 minute: 10 080 averages per time series.
    const plan = planExport(1, 4, START, START + 7 * DAY, MINUTE);

    expect(plan).toMatchObject({ points: 10080, pointsPerWindow: 10000, windows: 2, seriesPerRequest: 1, requests: 8 });
  });

  it('plans nothing without unit, metric or period', () => {
    expect(planExport(0, 4, START, START + DAY, HOUR).requests).toBe(0);
    expect(planExport(3, 0, START, START + DAY, HOUR).requests).toBe(0);
    expect(planExport(3, 4, START, START, HOUR)).toMatchObject({ points: 0, rows: 0, requests: 0 });
    expect(planExport(3, 4, START + DAY, START, HOUR).points).toBe(0);
  });
});

describe('dates', () => {
  it('parses a UTC day', () => {
    expect(parseUtcDay('2026-10-05')).toBe(START);
  });

  it('rejects what is not a day', () => {
    expect(parseUtcDay(null)).toBeNull();
    expect(parseUtcDay('')).toBeNull();
    expect(parseUtcDay('05/10/2026')).toBeNull();
    expect(parseUtcDay('2026-13-45')).toBeNull();
  });

  it('formats a UTC day', () => {
    expect(formatUtcDay(START + 13 * HOUR)).toBe('2026-10-05');
  });
});

describe('options', () => {
  it('knows the steps and the formats', () => {
    expect(isExportStepId('15m')).toBe(true);
    expect(isExportStepId('2h')).toBe(false);
    expect(getExportStep('1d').stepMs).toBe(DAY);
    expect(isCsvFormatId('fr')).toBe(true);
    expect(isCsvFormatId('xlsx')).toBe(false);
    expect(getCsvFormat('intl')).toMatchObject({ separator: ',', decimal: '.' });
  });
});

describe(buildCsv.name, () => {
  const units: ExportUnit[] = [
    { externalId: 'OS2', name: 'Mixer', siteName: 'Oslo' },
    { externalId: 'HO1', name: 'Main Drive, Indexing Chain Conveyor', siteName: 'Houston' },
  ];
  const series: ExportSeries[] = [
    { unitExternalId: 'OS2', metric: 'oee', points: [{ timestamp: START + HOUR, value: 0.5 }, { timestamp: START, value: 0.912345 }] },
    { unitExternalId: 'OS2', metric: 'quality', points: [{ timestamp: START, value: 1 }] },
    { unitExternalId: 'HO1', metric: 'oee', points: [{ timestamp: START, value: 0 }] },
  ];

  it('writes one row per unit and per step, sorted by site, unit and time, for French Excel', () => {
    const { content, rowCount } = buildCsv({ units, metrics: ['oee', 'quality'], series, format: getCsvFormat('fr') });

    expect(rowCount).toBe(3);
    expect(content).toBe(
      [
        'site;unit_type;unit;time_utc;oee;quality',
        'Houston;Main Drive, Indexing Chain Conveyor;HO1;2026-10-05 00:00:00;0;',
        'Oslo;Mixer;OS2;2026-10-05 00:00:00;0,9123;1',
        'Oslo;Mixer;OS2;2026-10-05 01:00:00;0,5;',
        '',
      ].join('\r\n')
    );
  });

  it('quotes the text that holds the separator in the international format', () => {
    const { content } = buildCsv({ units, metrics: ['oee'], series, format: getCsvFormat('intl') });

    expect(content.split('\r\n')[0]).toBe('site,unit_type,unit,time_utc,oee');
    expect(content.split('\r\n')[1]).toBe('Houston,"Main Drive, Indexing Chain Conveyor",HO1,2026-10-05 00:00:00,0');
    expect(content.split('\r\n')[2]).toBe('Oslo,Mixer,OS2,2026-10-05 00:00:00,0.9123');
  });

  it('keeps the columns in a fixed order and leaves out the units without value', () => {
    const { content, rowCount } = buildCsv({
      units: [...units, { externalId: 'XX9', name: 'Silent', siteName: 'Chicago' }],
      metrics: ['quality', 'oee'],
      series,
      format: getCsvFormat('intl'),
    });

    expect(content.startsWith('site,unit_type,unit,time_utc,oee,quality\r\n')).toBe(true);
    expect(content).not.toContain('Silent');
    expect(rowCount).toBe(3);
  });

  it('writes only the header for no data', () => {
    expect(buildCsv({ units, metrics: ['oee'], series: [], format: getCsvFormat('fr') })).toEqual({
      content: 'site;unit_type;unit;time_utc;oee\r\n',
      rowCount: 0,
    });
  });
});

describe(exportFileName.name, () => {
  it('names the file after the scope, the period and the step', () => {
    expect(exportFileName('Sao Paulo', 'Main Drive, Indexing Chain Conveyor', '2026-09-29', '2026-10-05', '15m')).toBe(
      'icf-oee_sao-paulo_main-drive-indexing-chain-conveyor_2026-09-29_2026-10-05_15m.csv'
    );
  });
});
