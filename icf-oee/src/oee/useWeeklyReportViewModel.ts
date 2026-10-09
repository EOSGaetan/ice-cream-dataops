import { useQuery } from '@tanstack/react-query';

import { useOeeDeps } from './oeeDeps';
import { explainError } from './oeeErrors';
import { formatUtcDay } from './oeeExport';
import { useReportStorage } from './reportForm';
import type { Site } from './types';
import { latestTimestamp, useAllUnitsQuery, useSitesQuery } from './useSiteUnits';
import { buildReportHtml, buildWeeklyReport, previousPeriod, reportFileName, reportPeriod } from './weeklyReport';
import type { ReportPeriod, WeeklyReport } from './weeklyReport';

export type WeeklyReportViewModel = {
  sites: Site[];
  /** Null: all sites. */
  siteId: string | null;
  setSite: (siteId: string | null) => void;
  /** Last day of the week, "YYYY-MM-DD" in UTC; null until the data dates are known. */
  lastDay: string | null;
  setLastDay: (lastDay: string | null) => void;
  /** The week of the report and the week it is compared with; null when the last day is not a day. */
  period: ReportPeriod | null;
  comparedWith: ReportPeriod | null;
  isLoading: boolean;
  /** Why the report could not be loaded, or null. */
  error: string | null;
  /** Null until everything is loaded. */
  report: WeeklyReport | null;
  /** The report has at least one value and can be downloaded. */
  canDownload: boolean;
  download: () => void;
  /** The file of the last download, or null. */
  downloadedFile: string | null;
};

export function useWeeklyReportViewModel(): WeeklyReportViewModel {
  const { service, downloadFile, now } = useOeeDeps();
  const { form, setForm } = useReportStorage();

  const sitesQuery = useSitesQuery();
  const sites = sitesQuery.data ?? [];
  const allUnitsQuery = useAllUnitsQuery(true);
  const allUnits = allUnitsQuery.data ?? null;

  // Default week: the 7 days that end on the day of the latest value.
  const latest = latestTimestamp((allUnits ?? []).map(({ unit }) => unit.updatedAt));
  const lastDay = form.lastDay ?? (latest === null ? null : formatUtcDay(latest));
  const period = reportPeriod(lastDay);
  const comparedWith = period === null ? null : previousPeriod(period);

  const units = (allUnits ?? []).filter(({ site }) => form.siteId === null || site.externalId === form.siteId);
  const unitIds = units.map(({ unit }) => unit.externalId);
  const canRead = allUnits !== null && period !== null && unitIds.length > 0;

  const currentQuery = useQuery({
    queryKey: ['oee', 'reportStats', period?.startMs ?? null, form.siteId, unitIds.length],
    queryFn: () =>
      period === null ? Promise.resolve([]) : service.getUnitOeeStatsForPeriod(unitIds, period.startMs, period.endMs),
    enabled: canRead,
  });
  const previousQuery = useQuery({
    queryKey: ['oee', 'reportStats', comparedWith?.startMs ?? null, form.siteId, unitIds.length],
    queryFn: () =>
      comparedWith === null
        ? Promise.resolve([])
        : service.getUnitOeeStatsForPeriod(unitIds, comparedWith.startMs, comparedWith.endMs),
    enabled: canRead,
  });

  const failure = sitesQuery.error ?? allUnitsQuery.error ?? currentQuery.error ?? previousQuery.error;
  const scope = sites.find((site) => site.externalId === form.siteId)?.name ?? 'All sites';
  const current = unitIds.length === 0 ? [] : currentQuery.data;
  const previous = unitIds.length === 0 ? [] : previousQuery.data;
  const report =
    allUnits === null || period === null || current === undefined || previous === undefined
      ? null
      : buildWeeklyReport({ units, current, previous, period, scope });
  const canDownload = report !== null && report.unitsWithData > 0;

  const download = () => {
    if (report === null || !canDownload) return;
    const fileName = reportFileName(report);
    downloadFile(fileName, buildReportHtml(report, now()));
    setForm({ ...form, downloadedFile: fileName });
  };

  return {
    sites,
    siteId: form.siteId,
    // A download says nothing about the new choices.
    setSite: (siteId) => setForm({ ...form, siteId, downloadedFile: null }),
    lastDay,
    setLastDay: (nextLastDay) => setForm({ ...form, lastDay: nextLastDay, downloadedFile: null }),
    period,
    comparedWith,
    // Loading the units, then the two weeks; a last day that is not a day loads nothing.
    isLoading: failure === null && report === null && (allUnits === null || period !== null),
    error: failure === null ? null : `The weekly report could not be loaded. ${explainError(failure)}`.trim(),
    report,
    canDownload,
    download,
    downloadedFile: form.downloadedFile,
  };
}
