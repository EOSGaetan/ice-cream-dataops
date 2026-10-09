import { createContext, useContext } from 'react';

/** What the user asked the weekly report to cover. Kept while the app is open. */
export type ReportForm = {
  /** Null: all sites. */
  siteId: string | null;
  /** Last day of the week, "YYYY-MM-DD" in UTC. Null: the day of the latest value. */
  lastDay: string | null;
  /** The name of the file of the last download, to confirm it on screen. */
  downloadedFile: string | null;
};

export const DEFAULT_REPORT_FORM: ReportForm = { siteId: null, lastDay: null, downloadedFile: null };

export type ReportStorage = {
  form: ReportForm;
  setForm: (next: ReportForm) => void;
};

export const ReportStorageContext = createContext<ReportStorage | null>(null);

export function useReportStorage(): ReportStorage {
  const storage = useContext(ReportStorageContext);
  if (storage === null) {
    throw new Error('useReportStorage must be used within a ReportStorageProvider');
  }
  return storage;
}
