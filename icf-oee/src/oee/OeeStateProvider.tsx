import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { OeeStateContext, parseOeeState } from './oeeState';
import type { OeeState } from './oeeState';

type OeeStateProviderProps = {
  /** The state string restored by the Fusion host (`connectToHostApp().initialState`). */
  initialState?: string;
  children: ReactNode;
};

/** Holds the selected site and unit once for the whole view tree. */
export function OeeStateProvider({ initialState, children }: OeeStateProviderProps) {
  const [state, setState] = useState<OeeState>(() => parseOeeState(initialState));
  const storage = useMemo(() => ({ state, setState }), [state]);

  return <OeeStateContext.Provider value={storage}>{children}</OeeStateContext.Provider>;
}
