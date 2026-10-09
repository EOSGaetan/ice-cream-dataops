import { useQuery } from '@tanstack/react-query';

import { useOeeDeps } from './oeeDeps';
import { toRegion } from './oeeRegions';
import type { DataRegion } from './oeeRegions';
import { useOeeState } from './oeeState';
import type { Site, TrendPoint, UnitOee } from './types';
import { useSitesQuery } from './useSiteUnits';

export type SiteDetailViewModel = {
  sites: DataRegion<Site>;
  /** The units of the selected site, with their latest values. */
  units: DataRegion<UnitOee>;
  selectedUnit: UnitOee | null;
  /** The OEE of the selected unit over the time frame. */
  trend: DataRegion<TrendPoint>;
};

/** The site tab: the units of the selected site and the OEE trend of the selected unit. */
export function useSiteDetailViewModel(): SiteDetailViewModel {
  const { service } = useOeeDeps();
  const { state } = useOeeState();
  const { siteId, unitId, range } = state;
  const isShown = state.view === 'site';

  const sitesQuery = useSitesQuery();

  const unitsQuery = useQuery({
    queryKey: ['oee', 'units', siteId],
    queryFn: () => (siteId === null ? Promise.resolve([]) : service.listUnits(siteId)),
    enabled: isShown && siteId !== null,
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
    enabled: isShown && trendUnitId !== null && trendEnd !== null,
  });

  return {
    sites: toRegion(sitesQuery, 'The sites could not be loaded.'),
    units: toRegion(unitsQuery, 'The units of this site could not be loaded.'),
    selectedUnit,
    trend: toRegion(trendQuery, 'The OEE trend could not be loaded.'),
  };
}
