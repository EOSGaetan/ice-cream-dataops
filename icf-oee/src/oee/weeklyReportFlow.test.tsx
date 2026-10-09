import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, SITES, UPDATED_AT } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { OeePage } from './OeePage';
import { createOeeService } from './oeeService';
import type { OeeCdfClient } from './oeeService';
import { useWeeklyReportViewModel } from './useWeeklyReportViewModel';

// The latest value of the test units is on 2026-10-04: the default week is the 7 days up to it.
const WEEK_START = Date.UTC(2026, 8, 28);
const WEEK_END = Date.UTC(2026, 9, 5);
const DAY = 24 * 60 * 60 * 1000;
const REPORT = JSON.stringify({ view: 'report' });
const UNIT_IDS = ['OSPRPATA241', 'OSPRFICHSP463', 'OSPRPATA241', 'OSPRFICHSP463'];
const FILE_NAME = 'icf-oee_weekly-report_all-sites_2026-09-28_2026-10-04.html';

describe('weekly report', () => {
  let service: FakeOeeService;
  let downloadFile: ReturnType<typeof vi.fn<(fileName: string, content: string) => void>>;

  beforeEach(() => {
    service = makeOeeService();
    downloadFile = vi.fn<(fileName: string, content: string) => void>();
  });

  describe('service', () => {
    let retrieve: ReturnType<typeof vi.fn<OeeCdfClient['datapoints']['retrieve']>>;
    let cdfService: ReturnType<typeof createOeeService>;

    beforeEach(() => {
      retrieve = vi.fn<OeeCdfClient['datapoints']['retrieve']>(() => Promise.resolve([]));
      cdfService = createOeeService(
        {
          instances: { list: vi.fn<OeeCdfClient['instances']['list']>() },
          datapoints: { retrieve, retrieveLatest: vi.fn<OeeCdfClient['datapoints']['retrieveLatest']>() },
        },
        { runner: { schedule: (fn) => fn() } }
      );
    });

    it('asks for the hourly OEE averages of the units over the period', async () => {
      await cdfService.getUnitOeeStatsForPeriod(['U1', 'U2'], WEEK_START, WEEK_END);

      expect(retrieve).toHaveBeenCalledTimes(1);
      expect(retrieve).toHaveBeenCalledWith({
        items: [
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:oee' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U2:oee' } },
        ],
        start: WEEK_START,
        end: WEEK_END,
        aggregates: ['average'],
        granularity: '1h',
        // 7 days of hourly averages, plus one.
        limit: 169,
        ignoreUnknownIds: true,
      });
    });

    it('computes the mean OEE and the hours below the alert threshold, in the order of the request', async () => {
      retrieve.mockResolvedValue([
        {
          id: 1,
          instanceId: { space: 'oee_ts_space', externalId: 'U2:oee' },
          isString: false,
          isStep: false,
          datapoints: [
            { timestamp: new Date(WEEK_START), average: 0.9 },
            { timestamp: new Date(WEEK_START + 3600000), average: 0.5 },
          ],
        },
      ]);

      await expect(cdfService.getUnitOeeStatsForPeriod(['U1', 'U2'], WEEK_START, WEEK_END)).resolves.toEqual([
        { externalId: 'U1', meanOee: null, periods: 0, periodsBelowAlert: 0 },
        { externalId: 'U2', meanOee: 0.7, periods: 2, periodsBelowAlert: 1 },
      ]);
    });

    it('asks nothing for no unit or an empty period', async () => {
      await expect(cdfService.getUnitOeeStatsForPeriod([], WEEK_START, WEEK_END)).resolves.toEqual([]);
      await expect(cdfService.getUnitOeeStatsForPeriod(['U1'], WEEK_END, WEEK_START)).resolves.toEqual([]);
      expect(retrieve).not.toHaveBeenCalled();
    });

    it('rejects when CDF fails', async () => {
      retrieve.mockRejectedValue(new Error('429'));

      await expect(cdfService.getUnitOeeStatsForPeriod(['U1'], WEEK_START, WEEK_END)).rejects.toThrow('429');
    });
  });

  describe('view model', () => {
    function renderViewModel() {
      return renderHook(() => useWeeklyReportViewModel(), { wrapper: makeOeeWrapper({ service, downloadFile }) });
    }

    it('is loading until the units and the two weeks are read', () => {
      service.listAllUnits.mockReturnValue(new Promise(() => undefined));

      const { result } = renderViewModel();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.report).toBeNull();
      expect(result.current.canDownload).toBe(false);
    });

    it('reports the week that ends on the day of the latest value, compared with the week before', async () => {
      const { result } = renderViewModel();

      await waitFor(() => expect(result.current.report).not.toBeNull());
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastDay).toBe('2026-10-04');
      expect(result.current.period).toMatchObject({ from: '2026-09-28', to: '2026-10-04' });
      expect(result.current.comparedWith).toMatchObject({ from: '2026-09-21', to: '2026-09-27' });
      expect(service.getUnitOeeStatsForPeriod).toHaveBeenCalledWith(UNIT_IDS, WEEK_START, WEEK_END);
      expect(service.getUnitOeeStatsForPeriod).toHaveBeenCalledWith(UNIT_IDS, WEEK_START - 7 * DAY, WEEK_START);
      expect(result.current.sites).toEqual(SITES);
      expect(result.current.report).toMatchObject({ scope: 'All sites', unitCount: 4, unitsWithData: 4, unitsBelowAlert: 2 });
      expect(result.current.report?.overall.meanOee).toBeCloseTo(0.7);
      expect(result.current.report?.overall.change).toBeCloseTo(0);
      expect(result.current.canDownload).toBe(true);
    });

    it('narrows the report to one site', async () => {
      const { result } = renderViewModel();
      await waitFor(() => expect(result.current.report).not.toBeNull());

      act(() => result.current.setSite('oslo'));

      await waitFor(() => expect(result.current.report?.scope).toBe('Oslo'));
      expect(result.current.report?.unitCount).toBe(2);
      expect(result.current.report?.sites.map((row) => row.site.name)).toEqual(['Oslo']);
      expect(service.getUnitOeeStatsForPeriod).toHaveBeenCalledWith(UNIT_IDS.slice(0, 2), WEEK_START, WEEK_END);
    });

    it('reads another week when the last day changes', async () => {
      const { result } = renderViewModel();
      await waitFor(() => expect(result.current.report).not.toBeNull());

      act(() => result.current.setLastDay('2026-09-27'));

      await waitFor(() =>
        expect(service.getUnitOeeStatsForPeriod).toHaveBeenCalledWith(UNIT_IDS, WEEK_START - 14 * DAY, WEEK_START - 7 * DAY)
      );
      expect(result.current.period).toMatchObject({ from: '2026-09-21', to: '2026-09-27' });
    });

    it('has no period and reads nothing when the last day is cleared', async () => {
      const { result } = renderViewModel();
      await waitFor(() => expect(result.current.report).not.toBeNull());
      service.getUnitOeeStatsForPeriod.mockClear();

      act(() => result.current.setLastDay('not a day'));

      expect(result.current.period).toBeNull();
      expect(result.current.report).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(service.getUnitOeeStatsForPeriod).not.toHaveBeenCalled();
    });

    it('reports an error with a readable message', async () => {
      service.getUnitOeeStatsForPeriod.mockRejectedValue(new Error('500'));

      const { result } = renderViewModel();

      await waitFor(() => expect(result.current.error).toBe('The weekly report could not be loaded. 500'));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.report).toBeNull();
    });

    it('cannot download a week without any value', async () => {
      service.getUnitOeeStatsForPeriod.mockResolvedValue([]);

      const { result } = renderViewModel();

      await waitFor(() => expect(result.current.report).not.toBeNull());
      expect(result.current.report?.unitsWithData).toBe(0);
      expect(result.current.canDownload).toBe(false);
      act(() => result.current.download());
      expect(downloadFile).not.toHaveBeenCalled();
    });

    it('downloads the report as an HTML file named after the scope and the week', async () => {
      const { result } = renderViewModel();
      await waitFor(() => expect(result.current.canDownload).toBe(true));

      act(() => result.current.download());

      expect(downloadFile).toHaveBeenCalledTimes(1);
      const [fileName, content] = downloadFile.mock.calls[0];
      expect(fileName).toBe(FILE_NAME);
      expect(content).toContain('<h1>Weekly OEE report</h1>');
      expect(content).toContain(`Generated on ${new Date(UPDATED_AT).toISOString().slice(0, 10)}`);
      expect(result.current.downloadedFile).toBe(FILE_NAME);
    });

    it('forgets the last download when the choices change', async () => {
      const { result } = renderViewModel();
      await waitFor(() => expect(result.current.canDownload).toBe(true));
      act(() => result.current.download());

      act(() => result.current.setSite('oslo'));

      expect(result.current.downloadedFile).toBeNull();
    });
  });

  describe('tab', () => {
    beforeEach(() => {
      // The Aura DataGrid is virtualized: it renders rows only when its scroll container has a size.
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('opens from the tabs and syncs the view to the host', async () => {
      const syncState = vi.fn<(serialized: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, syncState }) });

      await userEvent.click(screen.getByRole('tab', { name: 'Weekly report' }));

      expect(await screen.findByRole('heading', { level: 2, name: 'Weekly report' })).toBeInTheDocument();
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'report', siteId: null, unitId: null, unitType: null, range: '1w' })
      );
    });

    it('shows a loading indicator while the weeks load', () => {
      service.getUnitOeeStatsForPeriod.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: REPORT }) });

      expect(screen.getByText('Loading the two weeks of every unit…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled();
    });

    it('shows the week, its summary and the three tables', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: REPORT }) });

      const summary = await screen.findByRole('region', { name: 'Week summary' });
      expect(
        screen.getByText('Week from 2026-09-28 to 2026-10-04, compared with 2026-09-21 to 2026-09-27.')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Last day of the week (UTC)')).toHaveValue('2026-10-04');
      expect(within(summary).getByText('70.0%')).toBeInTheDocument();
      expect(within(summary).getByText('0.0 pts')).toBeInTheDocument();
      expect(within(summary).getByText('37.5%')).toBeInTheDocument();
      expect(within(summary).getByText('2')).toBeInTheDocument();
      const sites = screen.getByRole('table', { name: 'Sites over the week' });
      expect(await within(sites).findByText('Houston')).toBeInTheDocument();
      expect(within(sites).getByText('Oslo')).toBeInTheDocument();
      const types = screen.getByRole('table', { name: 'Unit types with the most time below 70% over the week' });
      expect(await within(types).findByText('Chocolate Spray')).toBeInTheDocument();
      const units = screen.getByRole('table', { name: 'Units with the lowest mean OEE over the week' });
      expect((await within(units).findAllByText('OSPRFICHSP463')).length).toBe(2);
    });

    it('downloads the report and says how to print it', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, downloadFile, initialState: REPORT }) });
      await screen.findByRole('region', { name: 'Week summary' });

      await userEvent.click(screen.getByRole('button', { name: 'Download report' }));

      expect(downloadFile).toHaveBeenCalledWith(FILE_NAME, expect.stringContaining('<h1>Weekly OEE report</h1>'));
      expect(
        screen.getByText(`Report downloaded as ${FILE_NAME}. Open it in a browser to print it or save it as PDF.`)
      ).toBeInTheDocument();
    });

    it('asks for a last day when it is cleared', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: REPORT }) });
      await screen.findByRole('region', { name: 'Week summary' });

      fireEvent.change(screen.getByLabelText('Last day of the week (UTC)'), { target: { value: '' } });

      // An empty field goes back to the default week: the report stays on screen.
      expect(await screen.findByRole('region', { name: 'Week summary' })).toBeInTheDocument();
    });

    it('says when the week has no value', async () => {
      service.getUnitOeeStatsForPeriod.mockResolvedValue([]);

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: REPORT }) });

      expect(await screen.findByText('No OEE values in this week')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled();
    });

    it('shows the error with a way to try again', async () => {
      service.getUnitOeeStatsForPeriod.mockRejectedValue(new Error('500'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: REPORT }) });

      expect(await screen.findByText('The weekly report could not be loaded. 500')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
  });
});
