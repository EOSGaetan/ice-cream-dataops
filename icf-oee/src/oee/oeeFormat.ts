import { OEE_ALERT_THRESHOLD } from './types';
import type { TrendPoint } from './types';

const NO_VALUE = '–';

/** 0.7717 → "77.2%" */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return NO_VALUE;
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Milliseconds since epoch → "2026-10-04 12:10 UTC" */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined || !Number.isFinite(timestamp)) return NO_VALUE;
  const iso = new Date(timestamp).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export type TrendSummary = {
  mean: number;
  min: number;
  max: number;
  start: number;
  end: number;
  /** Averaged periods whose OEE is below the alert threshold. */
  belowAlert: number;
  count: number;
};

export function summarizeTrend(points: TrendPoint[]): TrendSummary | null {
  if (points.length === 0) return null;
  const values = points.map((point) => point.oee);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    mean: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    start: points[0].timestamp,
    end: points[points.length - 1].timestamp,
    belowAlert: values.filter((value) => value < OEE_ALERT_THRESHOLD).length,
    count: values.length,
  };
}

/** "Main Drive, Indexing Chain Conveyor" cut to 16 characters becomes "Main Drive, Ind…". */
export function shortenName(name: string, maxLength: number): string {
  return name.length <= maxLength ? name : `${name.slice(0, maxLength - 1).trimEnd()}…`;
}
