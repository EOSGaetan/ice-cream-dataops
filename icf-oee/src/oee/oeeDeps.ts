import { createContext, useContext } from 'react';

import type { OeeService } from './oeeService';

/** What the OEE view model needs from the outside; injected so tests can replace it. */
export type OeeDeps = {
  service: OeeService;
  /** Pushes the serialized state to the Fusion host (`api.syncInternalState`). */
  syncState: (serialized: string) => void;
};

export const OeeDepsContext = createContext<OeeDeps | null>(null);

export function useOeeDeps(): OeeDeps {
  const deps = useContext(OeeDepsContext);
  if (deps === null) {
    throw new Error('useOeeDeps must be used within an OeeDepsContext.Provider');
  }
  return deps;
}
