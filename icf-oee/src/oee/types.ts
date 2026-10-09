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

const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/**
 * The time frames: how far back they go and how the datapoints are averaged (`granularity`,
 * one average every `stepMs`). `coarseGranularity` is used when only the mean over the whole
 * time frame matters.
 */
export const TREND_RANGES = [
  {
    id: '1w',
    label: '1W',
    period: '7 days',
    windowMs: 7 * DAY_MS,
    granularity: '1h',
    stepMs: HOUR_MS,
    bucket: 'hourly',
    coarseGranularity: '1d',
    coarseStepMs: DAY_MS,
  },
  {
    id: '1m',
    label: '1M',
    period: '30 days',
    windowMs: 30 * DAY_MS,
    granularity: '4h',
    stepMs: 4 * HOUR_MS,
    bucket: '4-hour',
    coarseGranularity: '1d',
    coarseStepMs: DAY_MS,
  },
  {
    id: '1y',
    label: '1Y',
    period: '365 days',
    windowMs: 365 * DAY_MS,
    granularity: '1d',
    stepMs: DAY_MS,
    bucket: 'daily',
    coarseGranularity: '30d',
    coarseStepMs: 30 * DAY_MS,
  },
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

/** The tabs of the app. */
export const OEE_VIEWS = ['overview', 'units', 'site', 'export'] as const;
export type OeeView = (typeof OEE_VIEWS)[number];

export function isOeeView(value: unknown): value is OeeView {
  return OEE_VIEWS.some((view) => view === value);
}

/** What one unit did over a time frame. */
export type UnitPeriodStats = {
  externalId: string;
  /** Mean of the averaged periods (hours, 4 hours or days) of the time frame. */
  meanOee: number | null;
  /** Averaged periods that have an OEE value. */
  periods: number;
  /** Averaged periods whose OEE is below the alert threshold. */
  periodsBelowAlert: number;
  quality: number | null;
  performance: number | null;
  availability: number | null;
};

/** The part of the unit statistics that ranks the units: read first. */
export type UnitOeeStats = Pick<UnitPeriodStats, 'externalId' | 'meanOee' | 'periods' | 'periodsBelowAlert'>;

/** The part of the unit statistics that explains a low OEE: read after the ranking is shown. */
export type UnitComponentMeans = Pick<UnitPeriodStats, 'externalId' | 'quality' | 'performance' | 'availability'>;

/** A unit and the site it belongs to. */
export type SiteUnit = {
  site: Site;
  unit: UnitOee;
};
