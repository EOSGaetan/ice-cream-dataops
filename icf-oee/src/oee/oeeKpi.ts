import { OEE_ALERT_THRESHOLD, OEE_WARNING_THRESHOLD } from './types';
import type { UnitOee } from './types';

export type OeeLevel = 'critical' | 'warning' | 'good' | 'unknown';

/** critical: below the alert threshold; warning: below the warning threshold. */
export function oeeLevel(ratio: number | null | undefined): OeeLevel {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return 'unknown';
  if (ratio < OEE_ALERT_THRESHOLD) return 'critical';
  if (ratio < OEE_WARNING_THRESHOLD) return 'warning';
  return 'good';
}

export type SiteSummary = {
  unitCount: number;
  /** Mean of the latest OEE of the units that have one. */
  meanOee: number | null;
  /** Units whose latest OEE is below the alert threshold. */
  belowAlertCount: number;
  lowestUnit: UnitOee | null;
};

export function summarizeSite(units: UnitOee[]): SiteSummary {
  let total = 0;
  let valueCount = 0;
  let belowAlertCount = 0;
  let lowestUnit: UnitOee | null = null;
  let lowestOee = Number.POSITIVE_INFINITY;

  for (const unit of units) {
    if (unit.oee === null) continue;
    total += unit.oee;
    valueCount++;
    if (unit.oee < OEE_ALERT_THRESHOLD) belowAlertCount++;
    if (unit.oee < lowestOee) {
      lowestOee = unit.oee;
      lowestUnit = unit;
    }
  }

  return {
    unitCount: units.length,
    meanOee: valueCount === 0 ? null : total / valueCount,
    belowAlertCount,
    lowestUnit,
  };
}
