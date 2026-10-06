import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useOeeDeps } from './oeeDeps';
import { lowestUnits, summarizeSite } from './oeeKpi';
import type { SiteSummary } from './oeeKpi';
import { useOeeState } from './oeeState';
import type { OeeState } from './oeeState';
import type { OeeView, Site, TrendPoint, TrendRangeId, UnitOee } from './types';

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
  const { view, siteId, unitId, range } = state;

  const sitesQuery = useQuery({
    queryKey: ['oee', 'sites'],
    queryFn: () => service.listSites(),
  });
  const sites = sitesQuery.data ?? [];

  // The overview needs the units of every site; the site tab reuses them from the same cache.
  const overviewQueries = useQueries({
    queries: (view === 'overview' ? sites : []).map((site) => ({
      queryKey: ['oee', 'units', site.externalId],
      queryFn: () => service.listUnits(site.externalId),
    })),
  });

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
      items: view === 'overview' ? sites.map((site, index) => toSiteOverview(site, overviewQueries[index])) : [],
      isLoading: sitesQuery.isLoading,
      error: sitesQuery.error === null ? null : `The sites could not be loaded. ${sitesQuery.error.message}`.trim(),
    },
    openSite,
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
