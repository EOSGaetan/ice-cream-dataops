import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { DEFAULT_EXPORT_FORM, ExportStorageContext } from './exportForm';
import type { ExportForm, ExportRun } from './exportForm';

/** Holds the export form and the state of the current export once for the whole view tree. */
export function ExportStorageProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<ExportForm>(DEFAULT_EXPORT_FORM);
  const [run, setRun] = useState<ExportRun>({ status: 'idle' });
  const storage = useMemo(() => ({ form, setForm, run, setRun }), [form, run]);

  return <ExportStorageContext.Provider value={storage}>{children}</ExportStorageContext.Provider>;
}
