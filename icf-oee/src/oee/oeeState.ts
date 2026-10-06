import { createContext, useContext } from 'react';

import { DEFAULT_TREND_RANGE, isOeeView, isTrendRangeId } from './types';
import type { OeeView, TrendRangeId } from './types';

/** What the user selected. Host-synced: it survives a reload and travels with a shared link. */
export type OeeState = {
  view: OeeView;
  siteId: string | null;
  unitId: string | null;
  /** Time frame of the OEE trend. */
  range: TrendRangeId;
};

export const DEFAULT_OEE_STATE: OeeState = {
  view: 'overview',
  siteId: null,
  unitId: null,
  range: DEFAULT_TREND_RANGE,
};

export type OeeStateStorage = {
  state: OeeState;
  setState: (next: OeeState) => void;
};

export const OeeStateContext = createContext<OeeStateStorage | null>(null);

export function useOeeState(): OeeStateStorage {
  const storage = useContext(OeeStateContext);
  if (storage === null) {
    throw new Error('useOeeState must be used within an OeeStateProvider');
  }
  return storage;
}

/** Parses the `initialState` string restored by the Fusion host; falls back to the default state. */
export function parseOeeState(serialized: string | undefined): OeeState {
  if (serialized === undefined || serialized === '') return DEFAULT_OEE_STATE;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_OEE_STATE;
    const siteId = 'siteId' in parsed && typeof parsed.siteId === 'string' ? parsed.siteId : null;
    const unitId = 'unitId' in parsed && typeof parsed.unitId === 'string' ? parsed.unitId : null;
    const range = 'range' in parsed && isTrendRangeId(parsed.range) ? parsed.range : DEFAULT_TREND_RANGE;
    // Links saved before the tabs existed have no view: a selected site means the site tab.
    const fallbackView: OeeView = siteId === null ? 'overview' : 'site';
    const view = 'view' in parsed && isOeeView(parsed.view) ? parsed.view : fallbackView;
    // A unit only makes sense inside a site.
    return { view, siteId, unitId: siteId === null ? null : unitId, range };
  } catch {
    return DEFAULT_OEE_STATE;
  }
}
