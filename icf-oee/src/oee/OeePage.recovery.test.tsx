import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_UNITS, makeOeeService, makeOeeWrapper } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { OeePage } from './OeePage';

const OSLO = JSON.stringify({ view: 'site', siteId: 'oslo' });
const EXPORT = JSON.stringify({ view: 'export' });

describe('OeePage recovery and touch screens', () => {
  let service: FakeOeeService;

  beforeEach(() => {
    service = makeOeeService();
    // The Aura DataGrid is virtualized: it renders rows only when its scroll container has a size.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('failed reads', () => {
    it('reads again what failed when Try again is pressed', async () => {
      service.listAllUnits.mockRejectedValueOnce(new Error('Network request failed'));
      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });
      await screen.findByText('The units could not be loaded. Network request failed');

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('button', { name: /^Oslo: site OEE 80\.0%/ })).toBeInTheDocument();
      expect(screen.queryByText('The units could not be loaded. Network request failed')).not.toBeInTheDocument();
      expect(service.listAllUnits).toHaveBeenCalledTimes(2);
      // The sites had loaded: they are not read again.
      expect(service.listSites).toHaveBeenCalledTimes(1);
    });

    it('says in plain words how to get access when CDF refuses the read', async () => {
      service.listSites.mockRejectedValue(Object.assign(new Error('Request failed | status code: 403'), { status: 403 }));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      expect(
        await screen.findByText(
          'The sites could not be loaded. You do not have access to this data (403). ' +
            'Ask the administrator of the CDF project for read access.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('touch screen', () => {
    it('gives the table rows a height of 40 px', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, isTouchScreen: true, initialState: OSLO }) });

      const table = await screen.findByRole('table', { name: 'Latest OEE by unit' });
      const row = (await within(table).findByText('Balance Tank')).closest('[role="row"]');

      expect(row).toHaveStyle({ height: '40px' });
    });

    it('keeps the default row height with a mouse', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });

      const table = await screen.findByRole('table', { name: 'Latest OEE by unit' });
      const row = (await within(table).findByText('Balance Tank')).closest('[role="row"]');

      expect(row).not.toHaveStyle({ height: '40px' });
    });
  });

  describe('export', () => {
    it('offers to cancel a running export and says that no file was downloaded', async () => {
      const downloadFile = vi.fn<(fileName: string, content: string) => void>();
      service.exportAverages.mockReturnValue(new Promise(() => undefined));
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, downloadFile, initialState: EXPORT }) });
      await screen.findByText(`${ALL_UNITS.length} units, 168 steps each: up to 672 rows, read in 1 request.`);
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

      await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      expect(await screen.findByText('Export cancelled. No file was downloaded.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(downloadFile).not.toHaveBeenCalled();
    });
  });
});
