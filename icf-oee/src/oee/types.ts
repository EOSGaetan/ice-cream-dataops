export const ASSET_SPACE = 'icapi_dm_space';
export const OEE_SPACE = 'oee_ts_space';

export const COMPANY_NAME = 'Full Icecreamergies';

/** Below this OEE a unit needs attention (the alert threshold of the bootcamp monitoring task). */
export const OEE_ALERT_THRESHOLD = 0.7;
/** Below this OEE a unit is worth watching. */
export const OEE_WARNING_THRESHOLD = 0.85;

export const OEE_METRICS =['oee', 'quality', 'performance', 'availability'] as const;
export type OeeMetric = (typeof OEE_METRICS)[number];

export type Site = {
  externalId: string;
  name: string;
};

/** Latest OEE values of one unit; a ratio is null when its time series has no datapoint. */
export type UnitOee = Record<OeeMetric, number | null> & {
  externalId: string;
  name: string;
  /** Time of the latest OEE datapoint, in milliseconds since epoch. */
  updatedAt: number | null;
};

export type TrendPoint = {
  /** Start of the averaged period, in milliseconds since epoch. */
  timestamp: number;
  oee: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The time frames of the trend: how far back it goes and how the datapoints are averaged. */
export const TREND_RANGES = [
  { id: '1w', label: '1W', period: '7 days', windowMs: 7 * DAY_MS, granularity: '1h', bucket: 'hourly' },
  { id: '1m', label: '1M', period: '30 days', windowMs: 30 * DAY_MS, granularity: '4h', bucket: '4-hour' },
  { id: '1y', label: '1Y', period: '365 days', windowMs: 365 * DAY_MS, granularity: '1d', bucket: 'daily' },
] as const;

export type TrendRange = (typeof TREND_RANGES)[number];
export type TrendRangeId = TrendRange['id'];
export const DEFAULT_TREND_RANGE: TrendRangeId = '1w';

export function isTrendRangeId(value: unknown): value is TrendRangeId {
  return TREND_RANGES.some((range) => range.id === value);
}

export function getTrendRange(id: TrendRangeId): TrendRange {
  return TREND_RANGES.find((range) => range.id === id) ?? TREND_RANGES[0];
}

/** The two tabs of the app. */
export const OEE_VIEWS = ['overview', 'site'] as const;
export type OeeView = (typeof OEE_VIEWS)[number];

export function isOeeView(value: unknown): value is OeeView {
  return OEE_VIEWS.some((view) => view === value);
}
