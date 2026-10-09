import { useCallback } from 'react';

import { useOeeDeps } from './oeeDeps';
import { useOeeState } from './oeeState';
import type { OeeState } from './oeeState';
import type { OeeView, TrendRangeId } from './types';

/** What the user selected, and the commands that change it. */
export type OeeSelection = {
  view: OeeView;
  selectView: (view: OeeView) => void;
  selectedSiteId: string | null;
  selectSite: (siteId: string) => void;
  /** Opens the site tab on a site. */
  openSite: (siteId: string) => void;
  selectUnit: (unitId: string) => void;
  /** Opens the site tab on one unit of a site. */
  openUnit: (siteId: string, unitId: string) => void;
  selectUnitType: (name: string) => void;
  trendRange: TrendRangeId;
  selectTrendRange: (range: TrendRangeId) => void;
};

/**
 * The selection lives in the shared state storage; every change is also pushed to the Fusion
 * host, so a reload or a shared link restores it.
 */
export function useOeeSelection(): OeeSelection {
  const { syncState } = useOeeDeps();
  const { state, setState } = useOeeState();
  const { view, siteId, unitId, range } = state;

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
    selectedSiteId: siteId,
    selectSite,
    openSite,
    selectUnit,
    openUnit,
    selectUnitType,
    trendRange: range,
    selectTrendRange,
  };
}
