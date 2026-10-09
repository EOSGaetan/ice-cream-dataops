import { useCallback } from 'react';

import { useExportStorage } from './exportForm';
import type { ExportForm, ExportRun } from './exportForm';
import { useOeeDeps } from './oeeDeps';
import {
  buildCsv,
  exportFileName,
  formatUtcDay,
  getCsvFormat,
  getExportStep,
  MAX_EXPORT_REQUESTS,
  MAX_EXPORT_ROWS,
  parseUtcDay,
  planExport,
} from './oeeExport';
import type { CsvFormatId, ExportMetric, ExportPlan, ExportStepId } from './oeeExport';
import { DAY_MS } from './types';
import type { Site } from './types';
import { latestTimestamp, useAllUnitsQuery, useSitesQuery } from './useSiteUnits';

/** The default period: the last 7 days of data. */
const DEFAULT_PERIOD_DAYS = 7;

export type ExportViewModel = {
  sites: Site[];
  /** The unit types of the chosen site, or of all sites. */
  unitTypes: string[];
  siteId: string | null;
  unitType: string | null;
  metrics: ExportMetric[];
  /** First and last day of the period, "YYYY-MM-DD" in UTC; null until the data dates are known. */
  from: string | null;
  to: string | null;
  stepId: ExportStepId;
  formatId: CsvFormatId;
  setSite: (siteId: string | null) => void;
  setUnitType: (unitType: string | null) => void;
  toggleMetric: (metric: ExportMetric, isSelected: boolean) => void;
  setFrom: (from: string | null) => void;
  setTo: (to: string | null) => void;
  setStep: (stepId: ExportStepId) => void;
  setFormat: (formatId: CsvFormatId) => void;
  /** The units of all sites are loading. */
  isLoading: boolean;
  /** Why the units could not be loaded, or null. */
  loadError: string | null;
  /** How many units match the site and the unit type. */
  unitCount: number;
  /** The size of the export, or null when the choices do not define one yet. */
  plan: ExportPlan | null;
  /** Why the export cannot start, or null when it can. */
  problem: string | null;
  run: ExportRun;
  exportCsv: () => void;
};

export function useExportViewModel(): ExportViewModel {
  const { service, downloadFile } = useOeeDeps();
  const { form, setForm, run, setRun } = useExportStorage();

  const sitesQuery = useSitesQuery();
  const sites = sitesQuery.data ?? [];
  const allUnitsQuery = useAllUnitsQuery(true);
  const allUnits = allUnitsQuery.data ?? null;
  const loadFailure = sitesQuery.error ?? allUnitsQuery.error;

  const inSite = (allUnits ?? []).filter(({ site }) => form.siteId === null || site.externalId === form.siteId);
  const unitTypes = [...new Set(inSite.map(({ unit }) => unit.name))].sort((a, b) => a.localeCompare(b));
  const matching = inSite.filter(({ unit }) => form.unitType === null || unit.name === form.unitType);

  // Default period: the 7 days that end on the day of the latest value.
  const latest = latestTimestamp((allUnits ?? []).map(({ unit }) => unit.updatedAt));
  const defaultTo = latest === null ? null : formatUtcDay(latest);
  const defaultFrom = latest === null ? null : formatUtcDay(latest - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS);
  const from = form.from ?? defaultFrom;
  const to = form.to ?? defaultTo;
  const startMs = parseUtcDay(from);
  const lastDayMs = parseUtcDay(to);
  // The last day is included: the period ends at the start of the next day.
  const endMs = lastDayMs === null ? null : lastDayMs + DAY_MS;

  const step = getExportStep(form.stepId);
  const plan =
    startMs === null || endMs === null || endMs <= startMs
      ? null
      : planExport(matching.length, form.metrics.length, startMs, endMs, step.stepMs);
  const problem = findProblem({
    isLoaded: allUnits !== null,
    metricCount: form.metrics.length,
    startMs,
    endMs,
    unitCount: matching.length,
    plan,
  });

  const update = useCallback(
    (next: ExportForm) => {
      setForm(next);
      // A finished or failed export says nothing about the new choices.
      if (run.status !== 'running') setRun({ status: 'idle' });
    },
    [run.status, setForm, setRun]
  );

  const exportCsv = () => {
    if (problem !== null || plan === null || startMs === null || endMs === null || from === null || to === null) return;
    if (run.status === 'running') return;
    const siteLabel = sites.find((site) => site.externalId === form.siteId)?.name ?? 'all sites';
    const fileName = exportFileName(siteLabel, form.unitType ?? 'all unit types', from, to, form.stepId);
    const units = matching.map(({ site, unit }) => ({
      externalId: unit.externalId,
      name: unit.name,
      siteName: site.name,
    }));

    setRun({ status: 'running', done: 0, total: plan.requests });
    service
      .exportAverages(
        {
          unitExternalIds: units.map((unit) => unit.externalId),
          metrics: form.metrics,
          startMs,
          endMs,
          stepId: form.stepId,
        },
        (done, total) => setRun({ status: 'running', done, total })
      )
      .then((series) => {
        const { content, rowCount } = buildCsv({
          units,
          metrics: form.metrics,
          series,
          format: getCsvFormat(form.formatId),
        });
        if (rowCount === 0) {
          setRun({ status: 'failed', message: 'There is no value for these units in this period.' });
          return;
        }
        downloadFile(fileName, content);
        setRun({ status: 'done', fileName, rowCount });
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : '';
        setRun({ status: 'failed', message: `The export failed. ${detail}`.trim() });
      });
  };

  return {
    sites,
    unitTypes,
    siteId: form.siteId,
    unitType: form.unitType,
    metrics: form.metrics,
    from,
    to,
    stepId: form.stepId,
    formatId: form.formatId,
    // A unit type that the new site does not have would match nothing: clear it.
    setSite: (siteId) => update({ ...form, siteId, unitType: null }),
    setUnitType: (unitType) => update({ ...form, unitType }),
    toggleMetric: (metric, isSelected) =>
      update({
        ...form,
        metrics: isSelected
          ? [...form.metrics.filter((selected) => selected !== metric), metric]
          : form.metrics.filter((selected) => selected !== metric),
      }),
    setFrom: (nextFrom) => update({ ...form, from: nextFrom }),
    setTo: (nextTo) => update({ ...form, to: nextTo }),
    setStep: (stepId) => update({ ...form, stepId }),
    setFormat: (formatId) => update({ ...form, formatId }),
    isLoading: allUnits === null && loadFailure === null,
    loadError: loadFailure === null ? null : `The units could not be loaded. ${loadFailure.message}`.trim(),
    unitCount: matching.length,
    plan,
    problem,
    run,
    exportCsv,
  };
}

type ProblemInput = {
  isLoaded: boolean;
  metricCount: number;
  startMs: number | null;
  endMs: number | null;
  unitCount: number;
  plan: ExportPlan | null;
};

function findProblem({ isLoaded, metricCount, startMs, endMs, unitCount, plan }: ProblemInput): string | null {
  if (!isLoaded) return 'The units are loading.';
  if (metricCount === 0) return 'Select at least one kind of data.';
  if (startMs === null || endMs === null) return 'Choose the first and the last day of the period.';
  if (endMs <= startMs) return 'The last day is before the first day.';
  if (unitCount === 0) return 'No unit matches this site and this unit type.';
  if (plan !== null && (plan.rows > MAX_EXPORT_ROWS || plan.requests > MAX_EXPORT_REQUESTS)) {
    return (
      `This export is too large: up to ${plan.rows.toLocaleString('en-US')} rows in ${plan.requests} requests ` +
      `(the limit is ${MAX_EXPORT_ROWS.toLocaleString('en-US')} rows and ${MAX_EXPORT_REQUESTS} requests). ` +
      'Narrow the site or the unit type, shorten the period or choose a larger step.'
    );
  }
  return null;
}
