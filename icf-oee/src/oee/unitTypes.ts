import type { Site, UnitOee, UnitPeriodStats } from './types';

/** One unit of a type: where it is and what it did over the time frame. */
export type UnitTypeMember = {
  site: Site;
  unit: UnitOee;
  /** Null when the unit has no statistics for the time frame. */
  stats: UnitPeriodStats | null;
};

/** The units that share a name, in every site: "Aging Tank" worldwide. */
export type UnitTypeStats = {
  name: string;
  unitCount: number;
  siteCount: number;
  /** Mean OEE over every averaged period of every unit of the type. */
  meanOee: number | null;
  /** Share of the averaged periods below the alert threshold, from 0 to 1. */
  belowAlertShare: number | null;
  quality: number | null;
  performance: number | null;
  availability: number | null;
  /** The site where the type has the lowest mean OEE. */
  lowestSite: { site: Site; meanOee: number } | null;
  /** Lowest mean OEE first. */
  members: UnitTypeMember[];
};

/** Share of the averaged periods of a unit below the alert threshold, from 0 to 1. */
export function belowAlertShare(stats: UnitPeriodStats | null): number | null {
  if (stats === null || stats.periods === 0) return null;
  return stats.periodsBelowAlert / stats.periods;
}

/**
 * Groups the units of every site by name and ranks the types: the one that spends the most
 * time below the alert threshold comes first.
 */
export function groupUnitTypes(members: UnitTypeMember[]): UnitTypeStats[] {
  const byName = new Map<string, UnitTypeMember[]>();
  for (const member of members) {
    const group = byName.get(member.unit.name);
    if (group === undefined) byName.set(member.unit.name, [member]);
    else group.push(member);
  }

  return [...byName.entries()].map(([name, group]) => toUnitType(name, group)).sort(byMostProblematic);
}

function toUnitType(name: string, group: UnitTypeMember[]): UnitTypeStats {
  const pooled = pool(group);
  const bySite = new Map<string, UnitTypeMember[]>();
  for (const member of group) {
    const siteGroup = bySite.get(member.site.externalId);
    if (siteGroup === undefined) bySite.set(member.site.externalId, [member]);
    else siteGroup.push(member);
  }

  let lowestSite: UnitTypeStats['lowestSite'] = null;
  for (const siteGroup of bySite.values()) {
    const siteMean = pool(siteGroup).meanOee;
    if (siteMean !== null && (lowestSite === null || siteMean < lowestSite.meanOee)) {
      lowestSite = { site: siteGroup[0].site, meanOee: siteMean };
    }
  }

  return {
    name,
    unitCount: group.length,
    siteCount: bySite.size,
    meanOee: pooled.meanOee,
    belowAlertShare: pooled.periods === 0 ? null : pooled.periodsBelowAlert / pooled.periods,
    quality: mean(group.map((member) => member.stats?.quality ?? null)),
    performance: mean(group.map((member) => member.stats?.performance ?? null)),
    availability: mean(group.map((member) => member.stats?.availability ?? null)),
    lowestSite,
    members: [...group].sort(byLowestMeanOee),
  };
}

/** Mean OEE and period counts over every averaged period of the given units. */
function pool(group: UnitTypeMember[]): { meanOee: number | null; periods: number; periodsBelowAlert: number } {
  let total = 0;
  let periods = 0;
  let periodsBelowAlert = 0;
  for (const { stats } of group) {
    if (stats === null || stats.meanOee === null) continue;
    total += stats.meanOee * stats.periods;
    periods += stats.periods;
    periodsBelowAlert += stats.periodsBelowAlert;
  }
  return { meanOee: periods === 0 ? null : total / periods, periods, periodsBelowAlert };
}

function mean(values: (number | null)[]): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value === null) continue;
    total += value;
    count++;
  }
  return count === 0 ? null : total / count;
}

function byMostProblematic(a: UnitTypeStats, b: UnitTypeStats): number {
  return (
    (b.belowAlertShare ?? -1) - (a.belowAlertShare ?? -1) ||
    (a.meanOee ?? Number.POSITIVE_INFINITY) - (b.meanOee ?? Number.POSITIVE_INFINITY) ||
    a.name.localeCompare(b.name)
  );
}

function byLowestMeanOee(a: UnitTypeMember, b: UnitTypeMember): number {
  return (
    (a.stats?.meanOee ?? Number.POSITIVE_INFINITY) - (b.stats?.meanOee ?? Number.POSITIVE_INFINITY) ||
    a.site.name.localeCompare(b.site.name) ||
    a.unit.externalId.localeCompare(b.unit.externalId)
  );
}
