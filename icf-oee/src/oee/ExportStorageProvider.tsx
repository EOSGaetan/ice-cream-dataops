import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { DEFAULT_EXPORT_FORM, ExportStorageContext } from './exportForm';
import type { ExportForm, ExportRun } from './exportForm';

/** Holds the export form and the state of the current export once for the whole view tree. */
export function ExportStorageProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<ExportForm>(DEFAULT_EXPORT_FORM);
  const [run, setRun] = useState<ExportRun>({ status: 'idle' });
  // The way to cancel the current run; not shown on screen, so not a state.
  const controllerRef = useRef<AbortController | null>(null);
  const beginRun = useCallback(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);
  const cancelRun = useCallback(() => controllerRef.current?.abort(), []);
  const storage = useMemo(
    () => ({ form, setForm, run, setRun, beginRun, cancelRun }),
    [form, run, beginRun, cancelRun]
  );

  return <ExportStorageContext.Provider value={storage}>{children}</ExportStorageContext.Provider>;
}
