import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, UNITS, UPDATED_AT } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { OeePage } from './OeePage';

const SITE_TAB = JSON.stringify({ view: 'site' });
const OSLO = JSON.stringify({ view: 'site', siteId: 'oslo' });
const OSLO_BALANCE_TANK = JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241' });

describe(OeePage.name, () => {
  let service: FakeOeeService;

  beforeEach(() => {
    service = makeOeeService();
    // The Aura DataGrid is virtualized: it renders rows only when its scroll container
    // has a size, which the test DOM does not compute.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the company name, the logo and the two tabs', () => {
    render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

    expect(screen.getByRole('heading', { level: 1, name: 'Ice Cream Factory OEE' })).toBeInTheDocument();
    expect(screen.getByText('Full Icecreamergies')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Full Icecreamergies logo' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Site' })).toHaveAttribute('aria-selected', 'false');
  });

  describe('overview tab', () => {
    it('shows the sites error', async () => {
      service.listSites.mockRejectedValue(new Error('403 Forbidden'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      await waitFor(() =>
        expect(screen.getByText('The sites could not be loaded. 403 Forbidden')).toBeInTheDocument()
      );
    });

    it('shows a loading indicator while the sites load', () => {
      service.listSites.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      expect(screen.getByText('Loading sites…')).toBeInTheDocument();
    });

    it('puts every site on the map with its site OEE and its lowest units', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      const oslo = await screen.findByRole('button', {
        name: 'Oslo: site OEE 80.0%. Lowest units: Chocolate Spray 77.2%, Balance Tank 82.8%.',
      });
      expect(oslo).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Houston: site OEE 80\.0%/ })).toBeInTheDocument();
      expect(screen.getByText('2 sites, coloured by the mean of the latest OEE of their units.')).toBeInTheDocument();
    });

    it('summarizes the same figures in a table, one row per site', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      const table = await screen.findByRole('table', { name: 'Lowest OEE units by site' });
      await waitFor(() => expect(within(table).getAllByText('Chocolate Spray')).toHaveLength(2));
      const rows = within(table)
        .getAllByRole('row')
        .map((row) => row.textContent ?? '')
        .filter((text) => text.includes('Chocolate Spray'));

      expect(rows).toHaveLength(2);
      expect(rows.some((text) => text.startsWith('Oslo'))).toBe(true);
      expect(rows.some((text) => text.startsWith('Houston'))).toBe(true);
      expect(rows[0]).toContain('80.0%');
      expect(rows[0]).toContain('77.2%');
      expect(rows[0]).toContain('Balance Tank');
      expect(rows[0]).toContain('82.8%');
    });

    it('says how many sites are still loading their units', async () => {
      service.listUnits.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      await waitFor(() => expect(screen.getByText('Loading the units of 2 of 2 sites…')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Oslo: loading' })).toBeInTheDocument();
    });

    it('opens the site tab when a site is selected on the map', async () => {
      const syncState = vi.fn<(serialized: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, syncState }) });

      await userEvent.click(await screen.findByRole('button', { name: /^Oslo: site OEE/ }));

      await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Units of Oslo' })).toBeInTheDocument());
      expect(screen.getByRole('tab', { name: 'Site' })).toHaveAttribute('aria-selected', 'true');
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: null, range: '1w' })
      );
    });

    it('opens the site tab when a table row is clicked', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });
      const table = await screen.findByRole('table', { name: 'Lowest OEE units by site' });

      await userEvent.click(await within(table).findByText('Houston'));

      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: 'Units of Houston' })).toBeInTheDocument()
      );
    });
  });

  describe('site tab', () => {
    it('switches to the site tab and asks to select a site', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      await userEvent.click(screen.getByRole('tab', { name: 'Site' }));

      expect(await screen.findByText('No site selected')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Select a site')).toBeInTheDocument());
      expect(screen.queryByText('OEE trend')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Site summary' })).not.toBeInTheDocument();
    });

    it('shows the sites error', async () => {
      service.listSites.mockRejectedValue(new Error('403 Forbidden'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: SITE_TAB }) });

      await waitFor(() =>
        expect(screen.getByText('The sites could not be loaded. 403 Forbidden')).toBeInTheDocument()
      );
    });

    it('shows a loading indicator while the units load', () => {
      service.listUnits.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });

      expect(screen.getByText('Loading units…')).toBeInTheDocument();
    });

    it('lists the units of the selected site with their latest values', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });

      await waitFor(() => expect(screen.getByRole('table', { name: 'Latest OEE by unit' })).toBeInTheDocument());
      expect(screen.getByRole('heading', { level: 2, name: 'Units of Oslo' })).toBeInTheDocument();
      expect(screen.getByText('2 units, lowest OEE first. Select a row to see the trend.')).toBeInTheDocument();
      expect(screen.getByText('Balance Tank')).toBeInTheDocument();
      expect(screen.getByText('82.8%')).toBeInTheDocument();
      expect(screen.getByText('Chocolate Spray')).toBeInTheDocument();
      expect(screen.getAllByText('2026-10-04 12:00 UTC')).toHaveLength(2);
      expect(screen.getByText('No unit selected')).toBeInTheDocument();
    });

    it('lists the unit with the lowest OEE first', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });
      await waitFor(() => expect(screen.getByText('Balance Tank')).toBeInTheDocument());

      const table = screen.getByRole('table', { name: 'Latest OEE by unit' });
      const names = within(table)
        .getAllByRole('row')
        .map((row) => row.textContent ?? '')
        .filter((text) => text.includes('OSPR'));

      expect(names).toHaveLength(2);
      expect(names[0]).toContain('Chocolate Spray');
      expect(names[1]).toContain('Balance Tank');
    });

    it('summarizes the site in four tiles', async () => {
      service.listUnits.mockResolvedValue([UNITS[0], { ...UNITS[1], oee: 0.5 }]);

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });

      const summary = await screen.findByRole('region', { name: 'Site summary' });
      expect(within(summary).getByText('Site OEE')).toBeInTheDocument();
      expect(within(summary).getByText('66.4%')).toBeInTheDocument();
      expect(within(summary).getByText('Units below 70%')).toBeInTheDocument();
      expect(within(summary).getByText('1')).toBeInTheDocument();
      expect(within(summary).getByText('Lowest unit')).toBeInTheDocument();
      expect(within(summary).getByText('50.0%')).toBeInTheDocument();
      expect(within(summary).getByText('Chocolate Spray (OSPRFICHSP463)')).toBeInTheDocument();
    });

    it('shows the units error', async () => {
      service.listUnits.mockRejectedValue(new Error('429'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });

      await waitFor(() =>
        expect(screen.getByText('The units of this site could not be loaded. 429')).toBeInTheDocument()
      );
    });

    it('says when a site has no unit with OEE', async () => {
      service.listUnits.mockResolvedValue([]);

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO }) });

      await waitFor(() => expect(screen.getByText('No units with OEE')).toBeInTheDocument());
    });

    it('shows the trend of the unit whose row is clicked and syncs the selection', async () => {
      const syncState = vi.fn<(serialized: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO }) });
      await waitFor(() => expect(screen.getByText('Balance Tank')).toBeInTheDocument());

      await userEvent.click(screen.getByText('Balance Tank'));

      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: 'OEE trend of Balance Tank' })).toBeInTheDocument()
      );
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', range: '1w' })
      );
      await waitFor(() =>
        expect(
          screen.getByText(
            'From 2026-10-04 11:00 UTC to 2026-10-04 12:00 UTC: ' +
              'mean 60.0%, minimum 40.0%, maximum 80.0%, 1 of 2 hourly averages below 70% (dashed line).'
          )
        ).toBeInTheDocument()
      );
      expect(screen.getByText('OSPRPATA241 · hourly average, 7 days')).toBeInTheDocument();
      expect(
        screen.getByRole('img', { name: 'Hourly average OEE of Balance Tank, with the 70% alert threshold' })
      ).toBeInTheDocument();
      expect(screen.getByText('(selected)')).toBeInTheDocument();
    });

    it('offers the 1W, 1M and 1Y time frames, 1W by default', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO_BALANCE_TANK }) });

      const timeFrames = await screen.findByRole('tablist', { name: 'Time frame of the trend' });
      expect(within(timeFrames).getByRole('tab', { name: '1W' })).toHaveAttribute('aria-selected', 'true');
      expect(within(timeFrames).getByRole('tab', { name: '1M' })).toHaveAttribute('aria-selected', 'false');
      expect(within(timeFrames).getByRole('tab', { name: '1Y' })).toHaveAttribute('aria-selected', 'false');
    });

    it('reloads the trend over one year when 1Y is selected', async () => {
      const syncState = vi.fn<(serialized: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO_BALANCE_TANK }) });
      const timeFrames = await screen.findByRole('tablist', { name: 'Time frame of the trend' });

      await userEvent.click(within(timeFrames).getByRole('tab', { name: '1Y' }));

      await waitFor(() => expect(service.getOeeTrend).toHaveBeenCalledWith('OSPRPATA241', UPDATED_AT, '1y'));
      expect(await screen.findByText('OSPRPATA241 · daily average, 365 days')).toBeInTheDocument();
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', range: '1y' })
      );
    });

    it('says when the selected unit has no OEE value in the period, and keeps the time frames', async () => {
      service.getOeeTrend.mockResolvedValue([]);

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO_BALANCE_TANK }) });

      await waitFor(() => expect(screen.getByText('No OEE values')).toBeInTheDocument());
      expect(screen.getByRole('tablist', { name: 'Time frame of the trend' })).toBeInTheDocument();
    });

    it('shows the trend error', async () => {
      service.getOeeTrend.mockRejectedValue(new Error('500'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: OSLO_BALANCE_TANK }) });

      await waitFor(() => expect(screen.getByText('The OEE trend could not be loaded. 500')).toBeInTheDocument());
    });
  });
});
