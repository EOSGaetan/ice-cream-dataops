import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, UNITS } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { OeePage } from './OeePage';

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

  it('asks to select a site when none is selected', async () => {
    render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

    expect(screen.getByRole('heading', { level: 1, name: 'Ice Cream Factory OEE' })).toBeInTheDocument();
    expect(screen.getByText('No site selected')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Select a site')).toBeInTheDocument());
    expect(screen.queryByText('OEE trend')).not.toBeInTheDocument();
  });

  it('shows the sites error', async () => {
    service.listSites.mockRejectedValue(new Error('403 Forbidden'));

    render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

    await waitFor(() => expect(screen.getByText('The sites could not be loaded. 403 Forbidden')).toBeInTheDocument());
  });

  it('shows a loading indicator while the units load', () => {
    service.listUnits.mockReturnValue(new Promise(() => undefined));

    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });

    expect(screen.getByText('Loading units…')).toBeInTheDocument();
  });

  it('lists the units of the selected site with their latest values', async () => {
    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });

    await waitFor(() => expect(screen.getByRole('table', { name: 'Latest OEE by unit' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 2, name: 'Units of Oslo' })).toBeInTheDocument();
    expect(screen.getByText('2 units, lowest OEE first. Select a row to see the trend.')).toBeInTheDocument();
    expect(screen.getByText('Balance Tank')).toBeInTheDocument();
    expect(screen.getByText('82.8%')).toBeInTheDocument();
    expect(screen.getByText('Chocolate Spray')).toBeInTheDocument();
    expect(screen.getAllByText('2026-10-04 12:00 UTC')).toHaveLength(2);
    expect(screen.getByText('No unit selected')).toBeInTheDocument();
  });

  it('shows the company name and logo', () => {
    render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

    expect(screen.getByText('Full Icecreamergies')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Full Icecreamergies logo' })).toBeInTheDocument();
  });

  it('lists the unit with the lowest OEE first', async () => {
    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });
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

    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });

    const summary = await screen.findByRole('region', { name: 'Site summary' });
    expect(within(summary).getByText('Site OEE')).toBeInTheDocument();
    expect(within(summary).getByText('66.4%')).toBeInTheDocument();
    expect(within(summary).getByText('Units below 70%')).toBeInTheDocument();
    expect(within(summary).getByText('1')).toBeInTheDocument();
    expect(within(summary).getByText('Lowest unit')).toBeInTheDocument();
    expect(within(summary).getByText('50.0%')).toBeInTheDocument();
    expect(within(summary).getByText('Chocolate Spray (OSPRFICHSP463)')).toBeInTheDocument();
  });

  it('shows no summary tiles before a site is selected', () => {
    render(<OeePage />, { wrapper: makeOeeWrapper({ service }) });

    expect(screen.queryByRole('region', { name: 'Site summary' })).not.toBeInTheDocument();
  });

  it('shows the units error', async () => {
    service.listUnits.mockRejectedValue(new Error('429'));

    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });

    await waitFor(() =>
      expect(screen.getByText('The units of this site could not be loaded. 429')).toBeInTheDocument()
    );
  });

  it('says when a site has no unit with OEE', async () => {
    service.listUnits.mockResolvedValue([]);

    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });

    await waitFor(() => expect(screen.getByText('No units with OEE')).toBeInTheDocument());
  });

  it('shows the trend of the unit whose row is clicked and syncs the selection', async () => {
    const syncState = vi.fn<(serialized: string) => void>();
    render(<OeePage />, {
      wrapper: makeOeeWrapper({ service, syncState, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });
    await waitFor(() => expect(screen.getByText('Balance Tank')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Balance Tank'));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'OEE trend of Balance Tank' })).toBeInTheDocument()
    );
    expect(syncState).toHaveBeenCalledWith(JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'From 2026-10-04 11:00 UTC to 2026-10-04 12:00 UTC: ' +
            'mean 60.0%, minimum 40.0%, maximum 80.0%, 1 of 2 hours below 70% (dashed line).'
        )
      ).toBeInTheDocument()
    );
    expect(screen.getByText('OSPRPATA241 · hourly average, 7 days')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Hourly average OEE of Balance Tank, with the 70% alert threshold' })
    ).toBeInTheDocument();
    expect(screen.getByText('(selected)')).toBeInTheDocument();
  });

  it('says when the selected unit has no OEE value in the period', async () => {
    service.getOeeTrend.mockResolvedValue([]);

    render(<OeePage />, {
      wrapper: makeOeeWrapper({
        service,
        initialState: JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }),
      }),
    });

    await waitFor(() => expect(screen.getByText('No OEE values')).toBeInTheDocument());
  });

  it('shows the trend error', async () => {
    service.getOeeTrend.mockRejectedValue(new Error('500'));

    render(<OeePage />, {
      wrapper: makeOeeWrapper({
        service,
        initialState: JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }),
      }),
    });

    await waitFor(() => expect(screen.getByText('The OEE trend could not be loaded. 500')).toBeInTheDocument());
  });
});
