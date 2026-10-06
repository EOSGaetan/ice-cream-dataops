import { createContext, useContext } from 'react';

/** What the user selected. Host-synced: it survives a reload and travels with a shared link. */
export type OeeState = {
  siteId: string | null;
  unitId: string | null;
};

export const DEFAULT_OEE_STATE: OeeState = { siteId: null, unitId: null };

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
    // A unit only makes sense inside a site.
    return { siteId, unitId: siteId === null ? null : unitId };
  } catch {
    return DEFAULT_OEE_STATE;
  }
}
