import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, SITES } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { useExportViewModel } from './useExportViewModel';

// The latest value of the test units is on 2026-10-04: the default period is the 7 days up to it.
const DEFAULT_FROM = '2026-09-28';
const DEFAULT_TO = '2026-10-04';
const DEFAULT_START = Date.UTC(2026, 8, 28);
const DEFAULT_END = Date.UTC(2026, 9, 5);

describe(useExportViewModel.name, () => {
  let service: FakeOeeService;
  let downloadFile: ReturnType<typeof vi.fn<(fileName: string, content: string) => void>>;

  beforeEach(() => {
    service = makeOeeService();
    downloadFile = vi.fn<(fileName: string, content: string) => void>();
  });

  function render() {
    return renderHook(() => useExportViewModel(), { wrapper: makeOeeWrapper({ service, downloadFile }) });
  }

  it('is loading the units of every site at first and cannot export yet', () => {
    service.listAllUnits.mockReturnValue(new Promise(() => undefined));

    const { result } = render();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.problem).toBe('The units are loading.');
    expect(result.current.from).toBeNull();
    expect(result.current.plan).toBeNull();
  });

  it('proposes all sites, all unit types, the four ratios, the last 7 days of data and an hourly step', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sites).toEqual(SITES);
    expect(result.current.unitTypes).toEqual(['Balance Tank', 'Chocolate Spray']);
    expect(result.current).toMatchObject({
      siteId: null,
      unitType: null,
      metrics: ['oee', 'quality', 'performance', 'availability'],
      from: DEFAULT_FROM,
      to: DEFAULT_TO,
      stepId: '1h',
      formatId: 'fr',
      unitCount: 4,
      problem: null,
      loadError: null,
      run: { status: 'idle' },
    });
    expect(result.current.plan).toMatchObject({ points: 168, rows: 672, requests: 1 });
  });

  it('reports an error of the units', async () => {
    service.listAllUnits.mockRejectedValue(new Error('429'));

    const { result } = render();

    await waitFor(() => expect(result.current.loadError).toBe('The units could not be loaded. 429'));
    expect(result.current.isLoading).toBe(false);
  });

  it('narrows the units to a site and a unit type', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSite('oslo'));
    expect(result.current.unitCount).toBe(2);

    act(() => result.current.setUnitType('Balance Tank'));
    expect(result.current.unitCount).toBe(1);
    expect(result.current.plan?.rows).toBe(168);

    // Another site may not have this unit type: the type is cleared.
    act(() => result.current.setSite('houston'));
    expect(result.current.unitType).toBeNull();
    expect(result.current.unitCount).toBe(2);
  });

  it('sizes the export from the period and the step', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFrom('2026-10-04'));
    act(() => result.current.setStep('15m'));

    // One day at 15 minutes: 96 steps for each of the 4 units.
    expect(result.current.plan).toMatchObject({ points: 96, rows: 384 });
  });

  it('says why the export cannot start', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setTo('2026-09-01'));
    expect(result.current.problem).toBe('The last day is before the first day.');

    act(() => result.current.setTo(null));
    for (const metric of ['oee', 'quality', 'performance', 'availability'] as const) {
      act(() => result.current.toggleMetric(metric, false));
    }
    expect(result.current.problem).toBe('Select at least one kind of data.');

    act(() => result.current.toggleMetric('off_spec', true));
    expect(result.current.metrics).toEqual(['off_spec']);
    expect(result.current.problem).toBeNull();
  });

  it('refuses an export that is too large', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFrom('2026-01-01'));
    act(() => result.current.setStep('1m'));

    expect(result.current.problem).toMatch(/^This export is too large: up to 1,595,520 rows/);

    act(() => result.current.exportCsv());
    expect(service.exportAverages).not.toHaveBeenCalled();
  });

  it('reads the chosen data and downloads a CSV file named after the choices', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.exportCsv());

    await waitFor(() => expect(result.current.run.status).toBe('done'));
    expect(service.exportAverages).toHaveBeenCalledWith(
      {
        unitExternalIds: ['OSPRPATA241', 'OSPRFICHSP463', 'OSPRPATA241', 'OSPRFICHSP463'],
        metrics: ['oee', 'quality', 'performance', 'availability'],
        startMs: DEFAULT_START,
        endMs: DEFAULT_END,
        stepId: '1h',
      },
      expect.any(Function),
      expect.any(AbortSignal)
    );
    const fileName = 'icf-oee_all-sites_all-unit-types_2026-09-28_2026-10-04_1h.csv';
    expect(result.current.run).toEqual({ status: 'done', fileName, rowCount: 4 });
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [name, content] = downloadFile.mock.calls[0];
    expect(name).toBe(fileName);
    expect(content.split('\r\n').slice(0, 2)).toEqual([
      'site;unit_type;unit;time_utc;oee;quality;performance;availability',
      'Houston;Balance Tank;OSPRPATA241;2026-10-04 12:00:00;0,8;;;',
    ]);
  });

  it('writes the international format and names the file after the site and the unit type', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setSite('oslo'));
    act(() => result.current.setUnitType('Chocolate Spray'));
    act(() => result.current.setFormat('intl'));

    act(() => result.current.exportCsv());

    await waitFor(() => expect(result.current.run.status).toBe('done'));
    const [name, content] = downloadFile.mock.calls[0];
    expect(name).toBe('icf-oee_oslo_chocolate-spray_2026-09-28_2026-10-04_1h.csv');
    expect(content.split('\r\n')[1]).toBe('Oslo,Chocolate Spray,OSPRFICHSP463,2026-10-04 12:00:00,0.6,,,');
  });

  it('shows the progress while the data is read', async () => {
    let finish: () => void = () => undefined;
    service.exportAverages.mockImplementation((_request, onProgress) => {
      onProgress?.(1, 3);
      return new Promise((resolve) => {
        finish = () => resolve([]);
      });
    });
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.exportCsv());

    await waitFor(() => expect(result.current.run).toEqual({ status: 'running', done: 1, total: 3 }));
    await act(async () => {
      finish();
      await Promise.resolve();
    });
  });

  it('says when there is no value in the period, without downloading a file', async () => {
    service.exportAverages.mockResolvedValue([]);
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.exportCsv());

    await waitFor(() =>
      expect(result.current.run).toEqual({
        status: 'failed',
        message: 'There is no value for these units in this period.',
      })
    );
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('reports a failed export and forgets it when the choices change', async () => {
    service.exportAverages.mockRejectedValue(new Error('500'));
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.exportCsv());
    await waitFor(() => expect(result.current.run).toEqual({ status: 'failed', message: 'The export failed. 500' }));

    act(() => result.current.setStep('1d'));
    expect(result.current.run).toEqual({ status: 'idle' });
  });
});
