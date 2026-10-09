import { createContext, useContext } from 'react';

import { DEFAULT_CSV_FORMAT, DEFAULT_EXPORT_METRICS, DEFAULT_EXPORT_STEP } from './oeeExport';
import type { CsvFormatId, ExportMetric, ExportStepId } from './oeeExport';

/** What the user asked to export. Kept while the app is open, not saved in the address. */
export type ExportForm = {
  /** Null: all sites. */
  siteId: string | null;
  /** Null: all unit types. */
  unitType: string | null;
  metrics: ExportMetric[];
  /** First day of the period, "YYYY-MM-DD" in UTC. Null: the default period. */
  from: string | null;
  /** Last day of the period, included. Null: the default period. */
  to: string | null;
  stepId: ExportStepId;
  formatId: CsvFormatId;
};

export const DEFAULT_EXPORT_FORM: ExportForm = {
  siteId: null,
  unitType: null,
  metrics: DEFAULT_EXPORT_METRICS,
  from: null,
  to: null,
  stepId: DEFAULT_EXPORT_STEP,
  formatId: DEFAULT_CSV_FORMAT,
};

/** Where the current export stands. */
export type ExportRun =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done'; fileName: string; rowCount: number }
  | { status: 'failed'; message: string };

export type ExportStorage = {
  form: ExportForm;
  setForm: (next: ExportForm) => void;
  run: ExportRun;
  setRun: (next: ExportRun) => void;
};

export const ExportStorageContext = createContext<ExportStorage | null>(null);

export function useExportStorage(): ExportStorage {
  const storage = useContext(ExportStorageContext);
  if (storage === null) {
    throw new Error('useExportStorage must be used within an ExportStorageProvider');
  }
  return storage;
}
