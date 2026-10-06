import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useOeeDeps } from './oeeDeps';
import { useOeeState } from './oeeState';
import type { OeeState } from './oeeState';
import type { Site, TrendPoint, UnitOee } from './types';

export type DataRegion<T> = {
  items: T[];
  isLoading: boolean;
  /** A message to show, or null when the last request succeeded. */
  error: string | null;
};

export type OeeViewModel = {
  sites: DataRegion<Site>;
  selectedSiteId: string | null;
  selectSite: (siteId: string) => void;
  units: DataRegion<UnitOee>;
  selectedUnit: UnitOee | null;
  selectUnit: (unitId: string) => void;
  trend: DataRegion<TrendPoint>;
};

export function useOeeViewModel(): OeeViewModel {
  const { service, syncState } = useOeeDeps();
  const { state, setState } = useOeeState();
  const { siteId, unitId } = state;

  const sitesQuery = useQuery({
    queryKey: ['oee', 'sites'],
    queryFn: () => service.listSites(),
  });

  const unitsQuery = useQuery({
    queryKey: ['oee', 'units', siteId],
    queryFn: () => (siteId === null ? Promise.resolve([]) : service.listUnits(siteId)),
    enabled: siteId !== null,
  });

  const selectedUnit = unitsQuery.data?.find((unit) => unit.externalId === unitId) ?? null;
  const trendUnitId = selectedUnit?.externalId ?? null;
  // The OEE series can stop hours or days before now: the trend ends at its latest value.
  const trendEnd = selectedUnit?.updatedAt ?? null;

  const trendQuery = useQuery({
    queryKey: ['oee', 'trend', trendUnitId, trendEnd],
    queryFn: () =>
      trendUnitId === null || trendEnd === null ? Promise.resolve([]) : service.getOeeTrend(trendUnitId, trendEnd),
    enabled: trendUnitId !== null && trendEnd !== null,
  });

  const update = useCallback(
    (next: OeeState) => {
      setState(next);
      syncState(JSON.stringify(next));
    },
    [setState, syncState]
  );

  const selectSite = useCallback((nextSiteId: string) => update({ siteId: nextSiteId, unitId: null }), [update]);
  const selectUnit = useCallback((nextUnitId: string) => update({ siteId, unitId: nextUnitId }), [siteId, update]);

  return {
    sites: toRegion(sitesQuery, 'The sites could not be loaded.'),
    selectedSiteId: siteId,
    selectSite,
    units: toRegion(unitsQuery, 'The units of this site could not be loaded.'),
    selectedUnit,
    selectUnit,
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
