import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { DEFAULT_REPORT_FORM, ReportStorageContext } from './reportForm';
import type { ReportForm } from './reportForm';

/** Holds the choices of the weekly report once for the whole view tree. */
export function ReportStorageProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<ReportForm>(DEFAULT_REPORT_FORM);
  const storage = useMemo(() => ({ form, setForm }), [form]);

  return <ReportStorageContext.Provider value={storage}>{children}</ReportStorageContext.Provider>;
}
