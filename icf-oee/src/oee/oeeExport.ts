import { DAY_MS } from './types';

/** The computed time series a CSV export can contain. */
export const EXPORT_METRICS = [
  { id: 'oee', label: 'OEE', column: 'oee' },
  { id: 'quality', label: 'Quality', column: 'quality' },
  { id: 'performance', label: 'Performance', column: 'performance' },
  { id: 'availability', label: 'Availability', column: 'availability' },
  { id: 'off_spec', label: 'Off-spec items', column: 'off_spec' },
] as const;
export type ExportMetric = (typeof EXPORT_METRICS)[number]['id'];
export const DEFAULT_EXPORT_METRICS: ExportMetric[] = ['oee', 'quality', 'performance', 'availability'];

const MINUTE_MS = 60 * 1000;

/** The steps of an export: one average per step. */
export const EXPORT_STEPS = [
  { id: '1m', label: '1 minute', granularity: '1m', stepMs: MINUTE_MS },
  { id: '5m', label: '5 minutes', granularity: '5m', stepMs: 5 * MINUTE_MS },
  { id: '15m', label: '15 minutes', granularity: '15m', stepMs: 15 * MINUTE_MS },
  { id: '1h', label: '1 hour', granularity: '1h', stepMs: 60 * MINUTE_MS },
  { id: '4h', label: '4 hours', granularity: '4h', stepMs: 240 * MINUTE_MS },
  { id: '1d', label: '1 day', granularity: '1d', stepMs: DAY_MS },
] as const;
export type ExportStep = (typeof EXPORT_STEPS)[number];
export type ExportStepId = ExportStep['id'];
export const DEFAULT_EXPORT_STEP: ExportStepId = '1h';

export function isExportStepId(value: unknown): value is ExportStepId {
  return EXPORT_STEPS.some((step) => step.id === value);
}

export function getExportStep(id: ExportStepId): ExportStep {
  return EXPORT_STEPS.find((step) => step.id === id) ?? EXPORT_STEPS[3];
}

/** How the numbers and columns are written, so the file opens directly in Excel. */
export const CSV_FORMATS = [
  { id: 'fr', label: 'Excel, French settings (; and decimal comma)', separator: ';', decimal: ',' },
  { id: 'intl', label: 'International (, and decimal point)', separator: ',', decimal: '.' },
] as const;
export type CsvFormat = (typeof CSV_FORMATS)[number];
export type CsvFormatId = CsvFormat['id'];
export const DEFAULT_CSV_FORMAT: CsvFormatId = 'fr';

export function isCsvFormatId(value: unknown): value is CsvFormatId {
  return CSV_FORMATS.some((format) => format.id === value);
}

export function getCsvFormat(id: CsvFormatId): CsvFormat {
  return CSV_FORMATS.find((format) => format.id === id) ?? CSV_FORMATS[0];
}

/** `timeseries/data/list` accepts at most 100 time series and 10 000 aggregates per request. */
const MAX_SERIES_PER_REQUEST = 100;
const MAX_AGGREGATES_PER_REQUEST = 10000;
/** Above these sizes an export is refused: the file would be too heavy for the browser and Excel. */
export const MAX_EXPORT_ROWS = 200000;
export const MAX_EXPORT_REQUESTS = 250;

export type ExportPlan = {
  /** Averages per time series over the period. */
  points: number;
  /** Rows of the file at most: one per unit and per step. */
  rows: number;
  /** The period is cut in windows of this many steps, so a request stays under the API limits. */
  pointsPerWindow: number;
  windows: number;
  seriesPerRequest: number;
  requests: number;
};

/** Sizes an export and cuts it in requests that respect the API limits. */
export function planExport(unitCount: number, metricCount: number, startMs: number, endMs: number, stepMs: number): ExportPlan {
  const points = Math.max(0, Math.ceil((endMs - startMs) / stepMs));
  const seriesCount = unitCount * metricCount;
  if (points === 0 || seriesCount === 0) {
    return { points, rows: 0, pointsPerWindow: 0, windows: 0, seriesPerRequest: 0, requests: 0 };
  }
  const pointsPerWindow = Math.min(points, MAX_AGGREGATES_PER_REQUEST);
  const seriesPerRequest = Math.max(
    1,
    Math.min(MAX_SERIES_PER_REQUEST, Math.floor(MAX_AGGREGATES_PER_REQUEST / pointsPerWindow))
  );
  const windows = Math.ceil(points / pointsPerWindow);
  return {
    points,
    rows: unitCount * points,
    pointsPerWindow,
    windows,
    seriesPerRequest,
    requests: Math.ceil(seriesCount / seriesPerRequest) * windows,
  };
}

/** "2026-10-05" → the start of that day in UTC, in milliseconds; null when the text is not a date. */
export function parseUtcDay(text: string | null): number | null {
  if (text === null || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const timestamp = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/** Milliseconds since epoch → "2026-10-05" (UTC). */
export function formatUtcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export type ExportUnit = {
  externalId: string;
  /** The unit type: the name shared by the units of the same kind. */
  name: string;
  siteName: string;
};

/** The averages of one time series of one unit. */
export type ExportSeries = {
  unitExternalId: string;
  metric: ExportMetric;
  points: { timestamp: number; value: number }[];
};

type CsvInput = {
  units: ExportUnit[];
  metrics: ExportMetric[];
  series: ExportSeries[];
  format: CsvFormat;
};

/**
 * One row per unit and per step: site, unit type, unit, time (UTC), then one column per
 * metric. This "long" layout is the one Excel pivot tables and filters work on.
 */
export function buildCsv({ units, metrics, series, format }: CsvInput): { content: string; rowCount: number } {
  const valuesByUnit = new Map<string, Map<number, Partial<Record<ExportMetric, number>>>>();
  for (const { unitExternalId, metric, points } of series) {
    let byTime = valuesByUnit.get(unitExternalId);
    if (byTime === undefined) {
      byTime = new Map();
      valuesByUnit.set(unitExternalId, byTime);
    }
    for (const { timestamp, value } of points) {
      let row = byTime.get(timestamp);
      if (row === undefined) {
        row = {};
        byTime.set(timestamp, row);
      }
      row[metric] = value;
    }
  }

  const columns = EXPORT_METRICS.filter((metric) => metrics.includes(metric.id));
  const lines = [['site', 'unit_type', 'unit', 'time_utc', ...columns.map((metric) => metric.column)].join(format.separator)];
  const sortedUnits = [...units].sort(
    (a, b) =>
      a.siteName.localeCompare(b.siteName) || a.name.localeCompare(b.name) || a.externalId.localeCompare(b.externalId)
  );
  for (const unit of sortedUnits) {
    const byTime = valuesByUnit.get(unit.externalId);
    if (byTime === undefined) continue;
    const prefix = [unit.siteName, unit.name, unit.externalId].map((text) => escapeCsv(text, format.separator));
    for (const timestamp of [...byTime.keys()].sort((a, b) => a - b)) {
      const row = byTime.get(timestamp) ?? {};
      lines.push(
        [...prefix, formatCsvTime(timestamp), ...columns.map((metric) => formatCsvNumber(row[metric.id], format.decimal))].join(
          format.separator
        )
      );
    }
  }
  return { content: `${lines.join('\r\n')}\r\n`, rowCount: lines.length - 1 };
}

/** "2026-10-05 13:00:00": a form Excel reads as a date and time. */
function formatCsvTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
}

function formatCsvNumber(value: number | undefined, decimal: string): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  // Four decimals: 0.0001 on a ratio is 0.01%.
  const text = String(Math.round(value * 10000) / 10000);
  return decimal === '.' ? text : text.replace('.', decimal);
}

function escapeCsv(text: string, separator: string): string {
  if (!text.includes(separator) && !text.includes('"') && !text.includes('\n') && !text.includes('\r')) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** "icf-oee_oslo_aging-tank_2026-09-29_2026-10-05_1h.csv" */
export function exportFileName(siteLabel: string, unitTypeLabel: string, from: string, to: string, stepId: ExportStepId): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `icf-oee_${slug(siteLabel)}_${slug(unitTypeLabel)}_${from}_${to}_${stepId}.csv`;
}
