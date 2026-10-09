import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, UNITS, UPDATED_AT } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { OeePage } from './OeePage';

const SITE_TAB = JSON.stringify({ view: 'site' });
const UNIT_TYPES = JSON.stringify({ view: 'units' });
const EXPORT = JSON.stringify({ view: 'export' });
const OSLO = JSON.stringify({ view: 'site', siteId: 'oslo' });
const OSLO_BALANCE_TANK = JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241' });
const CHART_TIMEOUT_MS = 10000;

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
    expect(screen.getByRole('tab', { name: 'Unit types' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Site' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'false');
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

    it('says that the units of the sites are still loading', async () => {
      service.listAllUnits.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      await waitFor(() => expect(screen.getByText('Loading the units of the 2 sites…')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Oslo: loading' })).toBeInTheDocument();
    });

    it('shows the units error once, above the map', async () => {
      service.listAllUnits.mockRejectedValue(new Error('429'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

      expect(await screen.findByText('The units could not be loaded. 429')).toBeInTheDocument();
    });

    it('opens the site tab when a site is selected on the map', async () => {
      const syncState = vi.fn<(serialized: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, syncState }) });

      await userEvent.click(await screen.findByRole('button', { name: /^Oslo: site OEE/ }));

      await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Units of Oslo' })).toBeInTheDocument());
      expect(screen.getByRole('tab', { name: 'Site' })).toHaveAttribute('aria-selected', 'true');
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: null, unitType: null, range: '1w' })
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

  describe('unit types tab', () => {
    it('shows a loading indicator while the statistics load', async () => {
      service.getUnitOeeStats.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });

      expect(screen.getByRole('tab', { name: 'Unit types' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Loading the statistics of every unit…')).toBeInTheDocument();
    });

    it('shows the statistics error', async () => {
      service.getUnitOeeStats.mockRejectedValue(new Error('500'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });

      await waitFor(() =>
        expect(screen.getByText('The unit statistics could not be loaded. 500')).toBeInTheDocument()
      );
    });

    it('says when no unit has statistics', async () => {
      service.listAllUnits.mockResolvedValue([]);

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });

      await waitFor(() => expect(screen.getByText('No unit statistics')).toBeInTheDocument());
    });

    it('ranks the unit types of all sites in a chart with a text summary', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Most problematic unit types' })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Share of the hourly averages below 70% OEE, all sites together. ' +
            'Highest: Chocolate Spray (50.0%), Balance Tank (25.0%).'
        )
      ).toBeInTheDocument();
      // The chart is loaded on demand: its first import can take a few seconds in the test runner.
      expect(
        await screen.findByRole(
          'img',
          { name: 'Share of the time below 70% OEE for the 2 most problematic unit types' },
          { timeout: CHART_TIMEOUT_MS }
        )
      ).toBeInTheDocument();
    });

    it('shows the ranking while the mean quality, performance and availability still load', async () => {
      service.getUnitComponentMeans.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });

      const table = await screen.findByRole('table', { name: 'Statistics by unit type' });
      expect(await within(table).findByText('Chocolate Spray')).toBeInTheDocument();
      expect(within(table).getAllByLabelText('Loading').length).toBeGreaterThan(0);
    });

    it('lists every unit type with its statistics, the most problematic first', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });

      const table = await screen.findByRole('table', { name: 'Statistics by unit type' });
      const rows = within(table)
        .getAllByRole('row')
        .map((row) => row.textContent ?? '')
        .filter((text) => /Chocolate Spray|Balance Tank/.test(text));

      expect(screen.getByText('2 types, 4 units. Select a row to see the units of a type.')).toBeInTheDocument();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toContain('Chocolate Spray');
      expect(rows[0]).toContain('50.0%');
      expect(rows[0]).toContain('60.0%');
      expect(rows[1]).toContain('Balance Tank');
      expect(rows[1]).toContain('25.0%');
      expect(rows[1]).toContain('80.0%');
      expect(screen.getByText('No unit type selected')).toBeInTheDocument();
    });

    it('offers the time frames and reloads the statistics over one month', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: UNIT_TYPES }) });
      const timeFrames = await screen.findByRole('tablist', { name: 'Time frame of the statistics' });

      await userEvent.click(within(timeFrames).getByRole('tab', { name: '1M' }));

      await waitFor(() =>
        expect(service.getUnitOeeStats).toHaveBeenCalledWith(expect.any(Array), UPDATED_AT, '1m')
      );
      expect(await screen.findByText(/over the last\s+30 days/)).toBeInTheDocument();
    });

    it('shows the units of the type whose row is clicked, site by site', async () => {
      const syncState = vi.fn<(serialized: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }) });
      const table = await screen.findByRole('table', { name: 'Statistics by unit type' });
      await within(table).findByText('Balance Tank');
      // The rows are drawn again when the mean quality, performance and availability arrive.
      await waitFor(() => expect(within(table).queryByLabelText('Loading')).not.toBeInTheDocument());

      await userEvent.click(within(table).getByText('Balance Tank'));

      expect(await screen.findByRole('heading', { level: 2, name: 'Balance Tank by site' })).toBeInTheDocument();
      expect(
        screen.getByText('2 units in 2 sites. Select a row to open the unit.')
      ).toBeInTheDocument();
      const detail = screen.getByRole('table', { name: 'Units of the selected type' });
      expect(await within(detail).findByText('Houston')).toBeInTheDocument();
      expect(within(detail).getByText('Oslo')).toBeInTheDocument();
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'units', siteId: null, unitId: null, unitType: 'Balance Tank', range: '1w' })
      );
    });

    it('opens the unit in the site tab when a unit of the type is clicked', async () => {
      render(<OeePage />, {
        wrapper: makeOeeWrapper({
          service,
          initialState: JSON.stringify({ view: 'units', unitType: 'Balance Tank' }),
        }),
      });
      const detail = await screen.findByRole('table', { name: 'Units of the selected type' });

      await userEvent.click(await within(detail).findByText('Oslo'));

      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: 'OEE trend of Balance Tank' })).toBeInTheDocument()
      );
      expect(screen.getByRole('tab', { name: 'Site' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('export tab', () => {
    it('shows a loading indicator while the units of every site load', () => {
      service.listAllUnits.mockReturnValue(new Promise(() => undefined));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });

      expect(screen.getByRole('heading', { level: 2, name: 'Export to CSV' })).toBeInTheDocument();
      expect(screen.getByText('Loading the units of every site…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    });

    it('shows the units error', async () => {
      service.listAllUnits.mockRejectedValue(new Error('429'));

      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });

      await waitFor(() => expect(screen.getByText('The units could not be loaded. 429')).toBeInTheDocument());
    });

    it('proposes the last 7 days of data, the four ratios and sizes the export', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });

      expect(
        await screen.findByText('4 units, 168 steps each: up to 672 rows, read in 1 request.')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('First day (UTC)')).toHaveValue('2026-09-28');
      expect(screen.getByLabelText('Last day (UTC), included')).toHaveValue('2026-10-04');
      expect(screen.getByRole('checkbox', { name: 'OEE' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Availability' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Off-spec items' })).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    });

    it('sizes the export again when the period changes', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });
      await screen.findByText('4 units, 168 steps each: up to 672 rows, read in 1 request.');

      fireEvent.change(screen.getByLabelText('First day (UTC)'), { target: { value: '2026-10-04' } });

      expect(
        await screen.findByText('4 units, 24 steps each: up to 96 rows, read in 1 request.')
      ).toBeInTheDocument();
    });

    it('explains why the export cannot start and disables the button', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });
      await screen.findByText('4 units, 168 steps each: up to 672 rows, read in 1 request.');

      for (const name of ['OEE', 'Quality', 'Performance', 'Availability']) {
        await userEvent.click(screen.getByRole('checkbox', { name }));
      }

      expect(await screen.findByText('Select at least one kind of data.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    });

    it('downloads the CSV file and says what was exported', async () => {
      const downloadFile = vi.fn<(fileName: string, content: string) => void>();
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, downloadFile, initialState: EXPORT }) });
      await screen.findByText('4 units, 168 steps each: up to 672 rows, read in 1 request.');

      await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(
        await screen.findByText(
          '4 rows exported to icf-oee_all-sites_all-unit-types_2026-09-28_2026-10-04_1h.csv.'
        )
      ).toBeInTheDocument();
      expect(downloadFile).toHaveBeenCalledWith(
        'icf-oee_all-sites_all-unit-types_2026-09-28_2026-10-04_1h.csv',
        expect.stringContaining('site;unit_type;unit;time_utc;oee;quality;performance;availability')
      );
    });

    it('shows a failed export', async () => {
      service.exportAverages.mockRejectedValue(new Error('500'));
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });
      await screen.findByText('4 units, 168 steps each: up to 672 rows, read in 1 request.');

      await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('The export failed. 500');
    });

    it('keeps the choices when leaving the tab and coming back', async () => {
      render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: EXPORT }) });
      await screen.findByText('4 units, 168 steps each: up to 672 rows, read in 1 request.');
      fireEvent.change(screen.getByLabelText('First day (UTC)'), { target: { value: '2026-10-04' } });

      await userEvent.click(screen.getByRole('tab', { name: 'Site' }));
      await userEvent.click(screen.getByRole('tab', { name: 'Export' }));

      expect(await screen.findByLabelText('First day (UTC)')).toHaveValue('2026-10-04');
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
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', unitType: null, range: '1w' })
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
        await screen.findByRole(
          'img',
          { name: 'Hourly average OEE of Balance Tank, with the 70% alert threshold' },
          { timeout: CHART_TIMEOUT_MS }
        )
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
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', unitType: null, range: '1y' })
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
