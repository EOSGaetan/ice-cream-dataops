import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useOeeDeps } from './oeeDeps';
import { explainError } from './oeeErrors';
import { lowestUnits, summarizeSite } from './oeeKpi';
import type { SiteSummary } from './oeeKpi';
import { useOeeState } from './oeeState';
import type { OeeState } from './oeeState';
import type {
  OeeView,
  Site,
  SiteUnit,
  TrendPoint,
  TrendRangeId,
  UnitComponentMeans,
  UnitOee,
  UnitOeeStats,
} from './types';
import { groupUnitTypes } from './unitTypes';
import type { UnitTypeStats } from './unitTypes';
import { latestTimestamp, useAllUnitsQuery, useSitesQuery } from './useSiteUnits';

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
  /** The ranking is shown; mean quality, performance and availability are still loading. */
  isLoadingUnitTypeDetails: boolean;
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

  const sitesQuery = useSitesQuery();
  const sites = sitesQuery.data ?? [];

  // The overview and the unit types need every unit of every site: one shared read.
  const allUnitsQuery = useAllUnitsQuery(view === 'overview' || view === 'units');

  // Unit types: what each unit did over the time frame.
  const allUnits = view === 'units' ? (allUnitsQuery.data ?? null) : null;
  const allUnitIds = allUnits?.map(({ unit }) => unit.externalId) ?? [];
  // One common end for every unit, so the types are compared over the same window.
  const statsEnd = latestTimestamp(allUnits?.map(({ unit }) => unit.updatedAt) ?? []);

  // The OEE statistics rank the types: they are read first, so the ranking shows early.
  const oeeStatsQuery = useQuery({
    queryKey: ['oee', 'unitOeeStats', range, statsEnd, allUnitIds.length],
    queryFn: () => (statsEnd === null ? Promise.resolve([]) : service.getUnitOeeStats(allUnitIds, statsEnd, range)),
    enabled: allUnits !== null && statsEnd !== null,
  });
  // Quality, performance and availability fill their columns afterwards.
  const componentsQuery = useQuery({
    queryKey: ['oee', 'unitComponentMeans', range, statsEnd, allUnitIds.length],
    queryFn: () =>
      statsEnd === null ? Promise.resolve([]) : service.getUnitComponentMeans(allUnitIds, statsEnd, range),
    enabled: allUnits !== null && statsEnd !== null && oeeStatsQuery.data !== undefined,
  });

  const unitTypes = toUnitTypes(allUnits, oeeStatsQuery.data, componentsQuery.data);
  const selectedUnitType = unitTypes.find((type) => type.name === unitType) ?? null;
  const unitTypesError = allUnitsQuery.error ?? oeeStatsQuery.error ?? componentsQuery.error;

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
      items: view === 'overview' ? sites.map((site) => toSiteOverview(site, allUnitsQuery)) : [],
      isLoading: sitesQuery.isLoading,
      error: sitesQuery.error === null ? null : `The sites could not be loaded. ${explainError(sitesQuery.error)}`.trim(),
    },
    openSite,
    unitTypes: {
      items: unitTypes,
      isLoading:
        view === 'units' &&
        unitTypesError === null &&
        (allUnits === null || (statsEnd !== null && oeeStatsQuery.data === undefined)),
      error:
        view !== 'units' || unitTypesError === null
          ? null
          : `The unit statistics could not be loaded. ${explainError(unitTypesError)}`.trim(),
    },
    isLoadingUnitTypeDetails: view === 'units' && unitTypes.length > 0 && componentsQuery.data === undefined,
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
    error: query.error === null ? null : `${message} ${explainError(query.error)}`.trim(),
  };
}

function toSiteOverview(site: Site, query: QueryState<SiteUnit>): SiteOverview {
  const units = query.data?.filter((siteUnit) => siteUnit.site.externalId === site.externalId).map(({ unit }) => unit);
  return {
    site,
    summary: units === undefined ? null : summarizeSite(units),
    lowestUnits: units === undefined ? [] : lowestUnits(units, LOWEST_UNIT_COUNT),
    isLoading: query.isLoading,
    error: query.error === null ? null : `The units could not be loaded. ${explainError(query.error)}`.trim(),
  };
}

function toUnitTypes(
  allUnits: SiteUnit[] | null,
  oeeStats: UnitOeeStats[] | undefined,
  componentMeans: UnitComponentMeans[] | undefined
): UnitTypeStats[] {
  if (allUnits === null || oeeStats === undefined) return [];
  const oeeByUnit = new Map(oeeStats.map((stats) => [stats.externalId, stats]));
  const componentsByUnit = new Map((componentMeans ?? []).map((means) => [means.externalId, means]));
  return groupUnitTypes(
    allUnits.map(({ site, unit }) => {
      const oee = oeeByUnit.get(unit.externalId);
      const components = componentsByUnit.get(unit.externalId);
      return {
        site,
        unit,
        stats:
          oee === undefined
            ? null
            : {
                ...oee,
                quality: components?.quality ?? null,
                performance: components?.performance ?? null,
                availability: components?.availability ?? null,
              },
      };
    })
  );
}
