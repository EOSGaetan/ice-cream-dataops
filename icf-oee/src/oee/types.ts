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
  /** Start of the hour, in milliseconds since epoch. */
  timestamp: number;
  oee: number;
};
