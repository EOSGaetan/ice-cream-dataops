import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EXPORT_SERIES, makeOeeService, makeOeeWrapper } from '../__mocks__/oee';

import type { ExportSeries } from './oeeExport';
import { createOeeService } from './oeeService';
import type { OeeCdfClient } from './oeeService';
import { useExportViewModel } from './useExportViewModel';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 4);

describe('cancelling an export', () => {
  describe('service', () => {
    it('sends no request and rejects once the export is cancelled', async () => {
      const retrieve = vi.fn<OeeCdfClient['datapoints']['retrieve']>(() => Promise.resolve([]));
      const service = createOeeService(
        {
          instances: { list: vi.fn<OeeCdfClient['instances']['list']>() },
          datapoints: { retrieve, retrieveLatest: vi.fn<OeeCdfClient['datapoints']['retrieveLatest']>() },
        },
        { runner: { schedule: (fn) => fn() } }
      );
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.exportAverages(
          { unitExternalIds: ['U1'], metrics: ['oee'], startMs: START, endMs: START + DAY, stepId: '1h' },
          undefined,
          controller.signal
        )
      ).rejects.toThrow();
      expect(retrieve).not.toHaveBeenCalled();
    });
  });

  describe('view model', () => {
    it('stops the running export: no file, and a late answer changes nothing', async () => {
      // Arrange: an export that answers only when the test says so.
      const service = makeOeeService();
      const downloadFile = vi.fn<(fileName: string, content: string) => void>();
      let answer: (series: ExportSeries[]) => void = () => undefined;
      service.exportAverages.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        })
      );
      const { result } = renderHook(() => useExportViewModel(), {
        wrapper: makeOeeWrapper({ service, downloadFile }),
      });
      await waitFor(() => expect(result.current.problem).toBeNull());
      act(() => result.current.exportCsv());
      expect(result.current.run.status).toBe('running');

      // Act
      act(() => result.current.cancelExport());

      // Assert
      expect(result.current.run).toEqual({ status: 'cancelled' });
      expect(service.exportAverages.mock.calls[0][2]?.aborted).toBe(true);
      await act(async () => {
        answer(EXPORT_SERIES);
        await Promise.resolve();
      });
      expect(result.current.run).toEqual({ status: 'cancelled' });
      expect(downloadFile).not.toHaveBeenCalled();
    });

    it('does nothing when no export is running', async () => {
      const service = makeOeeService();
      const { result } = renderHook(() => useExportViewModel(), { wrapper: makeOeeWrapper({ service }) });
      await waitFor(() => expect(result.current.problem).toBeNull());

      act(() => result.current.cancelExport());

      expect(result.current.run).toEqual({ status: 'idle' });
    });

    it('can export again after a cancelled export', async () => {
      const service = makeOeeService();
      const downloadFile = vi.fn<(fileName: string, content: string) => void>();
      service.exportAverages.mockReturnValueOnce(new Promise(() => undefined));
      const { result } = renderHook(() => useExportViewModel(), {
        wrapper: makeOeeWrapper({ service, downloadFile }),
      });
      await waitFor(() => expect(result.current.problem).toBeNull());
      act(() => result.current.exportCsv());
      act(() => result.current.cancelExport());

      act(() => result.current.exportCsv());

      await waitFor(() => expect(result.current.run.status).toBe('done'));
      expect(downloadFile).toHaveBeenCalledTimes(1);
    });
  });
});
