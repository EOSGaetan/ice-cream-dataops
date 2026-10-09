import { createContext, useContext } from 'react';

import type { OeeService } from './oeeService';
import { TOUCH_HEADER_HEIGHT_PX, TOUCH_ROW_HEIGHT_PX } from './touchScreen';

/** What the OEE view model needs from the outside; injected so tests can replace it. */
export type OeeDeps = {
  service: OeeService;
  /** Pushes the serialized state to the Fusion host (`api.syncInternalState`). */
  syncState: (serialized: string) => void;
  /** Hands a text file to the browser as a download. */
  downloadFile: (fileName: string, content: string) => void;
  /** The main pointer is a finger: the tables get taller rows. */
  isTouchScreen: boolean;
  /** The current time, in milliseconds since epoch. */
  now: () => number;
};

export const OeeDepsContext = createContext<OeeDeps | null>(null);

export function useOeeDeps(): OeeDeps {
  const deps = useContext(OeeDepsContext);
  if (deps === null) {
    throw new Error('useOeeDeps must be used within an OeeDepsContext.Provider');
  }
  return deps;
}

type TableHeights = { rowHeight: number | undefined; headerHeight: number | undefined };

/** The heights of the table rows: taller on a touch screen, the design-system defaults otherwise. */
export function useTableHeights(): TableHeights {
  return useOeeDeps().isTouchScreen
    ? { rowHeight: TOUCH_ROW_HEIGHT_PX, headerHeight: TOUCH_HEADER_HEIGHT_PX }
    : { rowHeight: undefined, headerHeight: undefined };
}
