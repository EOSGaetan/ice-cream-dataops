import { useQuery } from '@tanstack/react-query';

import { useOeeDeps } from './oeeDeps';
import { toErrorMessage } from './oeeRegions';
import type { DataRegion } from './oeeRegions';
import { useOeeState } from './oeeState';
import type { SiteUnit, UnitComponentMeans, UnitOeeStats } from './types';
import { groupUnitTypes } from './unitTypes';
import type { UnitTypeStats } from './unitTypes';
import { latestTimestamp, useAllUnitsQuery } from './useSiteUnits';

export type UnitTypesViewModel = {
  /** The unit types worldwide over the time frame, most time below the alert threshold first. */
  unitTypes: DataRegion<UnitTypeStats>;
  /** The ranking is shown; mean quality, performance and availability are still loading. */
  isLoadingUnitTypeDetails: boolean;
  selectedUnitType: UnitTypeStats | null;
};

/** The unit types tab: what each kind of unit did over the time frame, in all sites together. */
export function useUnitTypesViewModel(): UnitTypesViewModel {
  const { service } = useOeeDeps();
  const { state } = useOeeState();
  const { range } = state;
  const isShown = state.view === 'units';

  const allUnitsQuery = useAllUnitsQuery(isShown);
  const allUnits = isShown ? (allUnitsQuery.data ?? null) : null;
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
  const failure = allUnitsQuery.error ?? oeeStatsQuery.error ?? componentsQuery.error;

  return {
    unitTypes: {
      items: unitTypes,
      isLoading:
        isShown && failure === null && (allUnits === null || (statsEnd !== null && oeeStatsQuery.data === undefined)),
      error: isShown ? toErrorMessage('The unit statistics could not be loaded.', failure) : null,
    },
    isLoadingUnitTypeDetails: isShown && unitTypes.length > 0 && componentsQuery.data === undefined,
    selectedUnitType: unitTypes.find((type) => type.name === state.unitType) ?? null,
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
