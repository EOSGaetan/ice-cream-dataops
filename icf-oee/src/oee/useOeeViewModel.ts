import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useOeeDeps } from './oeeDeps';
import { lowestUnits, summarizeSite } from './oeeKpi';
import type { SiteSummary } from './oeeKpi';
import { useOeeState } from './oeeState';
import type { OeeState } from './oeeState';
import type { OeeView, Site, TrendPoint, TrendRangeId, UnitOee, UnitPeriodStats } from './types';
import { groupUnitTypes } from './unitTypes';
import type { UnitTypeStats } from './unitTypes';

/** How many of the lowest units the overview shows per site. */
const LOWEST_UNIT_COUNT = 3;

export type DataRegion<T> = {
  items: T[];
  isLoading: boolean;
  /** A message to show, or null when the last request succeeded. */
  error: string | null;
};

/** One site of the overview: its summary and its units with the lowest OEE. */
export type SiteOverview = {
  site: Site;
  /** Null while the units of the site load, or when they could not be loaded. */
  summary: SiteSummary | null;
  lowestUnits: UnitOee[];
  isLoading: boolean;
  error: string | null;
};

export type OeeViewModel = {
  view: OeeView;
  selectView: (view: OeeView) => void;
  sites: DataRegion<Site>;
  overview: DataRegion<SiteOverview>;
  /** Opens the site tab on a site. */
  openSite: (siteId: string) => void;
  /** The unit types worldwide over the time frame, most time below the alert threshold first. */
  unitTypes: DataRegion<UnitTypeStats>;
  selectedUnitType: UnitTypeStats | null;
  selectUnitType: (name: string) => void;
  /** Opens the site tab on one unit of a site. */
  openUnit: (siteId: string, unitId: string) => void;
  selectedSiteId: string | null;
  selectSite: (siteId: string) => void;
  units: DataRegion<UnitOee>;
  selectedUnit: UnitOee | null;
  selectUnit: (unitId: string) => void;
  trendRange: TrendRangeId;
  selectTrendRange: (range: TrendRangeId) => void;
  trend: DataRegion<TrendPoint>;
};

export function useOeeViewModel(): OeeViewModel {
  const { service, syncState } = useOeeDeps();
  const { state, setState } = useOeeState();
  const { view, siteId, unitId, unitType, range } = state;

  const sitesQuery = useQuery({
    queryKey: ['oee', 'sites'],
    queryFn: () => service.listSites(),
  });
  const sites = sitesQuery.data ?? [];

  // The overview and the unit types need the units of every site; the site tab reuses them
  // from the same cache.
  const needsAllSites = view === 'overview' || view === 'units';
  const siteUnitQueries = useQueries({
    queries: (needsAllSites ? sites : []).map((site) => ({
      queryKey: ['oee', 'units', site.externalId],
      queryFn: () => service.listUnits(site.externalId),
    })),
  });

  // Unit types: every unit of every site, then what each did over the time frame.
  const allUnits =
    view === 'units' && sites.length > 0 && siteUnitQueries.every((query) => query.data !== undefined)
      ? sites.flatMap((site, index) => (siteUnitQueries[index]?.data ?? []).map((unit) => ({ site, unit })))
      : null;
  const allUnitIds = allUnits?.map(({ unit }) => unit.externalId) ?? [];
  // One common end for every unit, so the types are compared over the same window.
  const statsEnd = latestTimestamp(allUnits?.map(({ unit }) => unit.updatedAt) ?? []);

  const unitStatsQuery = useQuery({
    queryKey: ['oee', 'unitStats', range, statsEnd, allUnitIds.length],
    queryFn: () => (statsEnd === null ? Promise.resolve([]) : service.getUnitPeriodStats(allUnitIds, statsEnd, range)),
    enabled: allUnits !== null && statsEnd !== null,
  });

  const unitTypes = toUnitTypes(allUnits, unitStatsQuery.data);
  const selectedUnitType = unitTypes.find((type) => type.name === unitType) ?? null;
  const siteUnitsError = siteUnitQueries.find((query) => query.error !== null)?.error ?? null;
  const unitTypesError = sitesQuery.error ?? siteUnitsError ?? unitStatsQuery.error;

  const unitsQuery = useQuery({
    queryKey: ['oee', 'units', siteId],
    queryFn: () => (siteId === null ? Promise.resolve([]) : service.listUnits(siteId)),
    enabled: view === 'site' && siteId !== null,
  });

  const selectedUnit = unitsQuery.data?.find((unit) => unit.externalId === unitId) ?? null;
  const trendUnitId = selectedUnit?.externalId ?? null;
  // The OEE series can stop hours or days before now: the trend ends at its latest value.
  const trendEnd = selectedUnit?.updatedAt ?? null;

  const trendQuery = useQuery({
    queryKey: ['oee', 'trend', trendUnitId, trendEnd, range],
    queryFn: () =>
      trendUnitId === null || trendEnd === null
        ? Promise.resolve([])
        : service.getOeeTrend(trendUnitId, trendEnd, range),
    enabled: view === 'site' && trendUnitId !== null && trendEnd !== null,
  });

  const update = useCallback(
    (next: OeeState) => {
      setState(next);
      syncState(JSON.stringify(next));
    },
    [setState, syncState]
  );

  const selectView = useCallback((nextView: OeeView) => update({ ...state, view: nextView }), [state, update]);
  const openSite = useCallback(
    (nextSiteId: string) =>
      update({ ...state, view: 'site', siteId: nextSiteId, unitId: nextSiteId === siteId ? unitId : null }),
    [siteId, state, unitId, update]
  );
  const selectUnitType = useCallback((name: string) => update({ ...state, unitType: name }), [state, update]);
  const openUnit = useCallback(
    (nextSiteId: string, nextUnitId: string) =>
      update({ ...state, view: 'site', siteId: nextSiteId, unitId: nextUnitId }),
    [state, update]
  );
  const selectSite = useCallback(
    (nextSiteId: string) => update({ ...state, siteId: nextSiteId, unitId: null }),
    [state, update]
  );
  const selectUnit = useCallback((nextUnitId: string) => update({ ...state, unitId: nextUnitId }), [state, update]);
  const selectTrendRange = useCallback(
    (nextRange: TrendRangeId) => update({ ...state, range: nextRange }),
    [state, update]
  );

  return {
    view,
    selectView,
    sites: toRegion(sitesQuery, 'The sites could not be loaded.'),
    overview: {
      items: view === 'overview' ? sites.map((site, index) => toSiteOverview(site, siteUnitQueries[index])) : [],
      isLoading: sitesQuery.isLoading,
      error: sitesQuery.error === null ? null : `The sites could not be loaded. ${sitesQuery.error.message}`.trim(),
    },
    openSite,
    unitTypes: {
      items: unitTypes,
      isLoading:
        view === 'units' &&
        unitTypesError === null &&
        (sitesQuery.isLoading || allUnits === null || unitStatsQuery.isLoading),
      error:
        view !== 'units' || unitTypesError === null
          ? null
          : `The unit statistics could not be loaded. ${unitTypesError.message}`.trim(),
    },
    selectedUnitType,
    selectUnitType,
    openUnit,
    selectedSiteId: siteId,
    selectSite,
    units: toRegion(unitsQuery, 'The units of this site could not be loaded.'),
    selectedUnit,
    selectUnit,
    trendRange: range,
    selectTrendRange,
    trend: toRegion(trendQuery, 'The OEE trend could not be loaded.'),
  };
}

type QueryState<T> = {
  data: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

function toRegion<T>(query: QueryState<T>, message: string): DataRegion<T> {
  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error === null ? null : `${message} ${query.error.message}`.trim(),
  };
}

function toSiteOverview(site: Site, query: QueryState<UnitOee> | undefined): SiteOverview {
  const units = query?.data;
  return {
    site,
    summary: units === undefined ? null : summarizeSite(units),
    lowestUnits: units === undefined ? [] : lowestUnits(units, LOWEST_UNIT_COUNT),
    isLoading: query?.isLoading ?? true,
    error: query === undefined || query.error === null ? null : `The units could not be loaded. ${query.error.message}`.trim(),
  };
}

function toUnitTypes(
  allUnits: { site: Site; unit: UnitOee }[] | null,
  stats: UnitPeriodStats[] | undefined
): UnitTypeStats[] {
  if (allUnits === null || stats === undefined) return [];
  const statsByUnit = new Map(stats.map((unitStats) => [unitStats.externalId, unitStats]));
  return groupUnitTypes(
    allUnits.map(({ site, unit }) => ({ site, unit, stats: statsByUnit.get(unit.externalId) ?? null }))
  );
}

/** The latest of the given timestamps, or null when there is none. */
function latestTimestamp(timestamps: (number | null)[]): number | null {
  let latest: number | null = null;
  for (const timestamp of timestamps) {
    if (timestamp !== null && (latest === null || timestamp > latest)) latest = timestamp;
  }
  return latest;
}
