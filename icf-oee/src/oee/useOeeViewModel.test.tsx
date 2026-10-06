import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, SITES, TREND, UNITS, UPDATED_AT } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { useOeeViewModel } from './useOeeViewModel';

describe(useOeeViewModel.name, () => {
  let service: FakeOeeService;
  let syncState: ReturnType<typeof vi.fn<(serialized: string) => void>>;

  beforeEach(() => {
    service = makeOeeService();
    syncState = vi.fn<(serialized: string) => void>();
  });

  it('is loading the sites at first, with nothing selected', () => {
    service.listSites.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

    expect(result.current.sites).toEqual({ items: [], isLoading: true, error: null });
    expect(result.current.selectedSiteId).toBeNull();
    expect(result.current.units.isLoading).toBe(false);
    expect(service.listUnits).not.toHaveBeenCalled();
  });

  it('exposes the sites once loaded', async () => {
    const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

    await waitFor(() => expect(result.current.sites.items).toEqual(SITES));
    expect(result.current.sites.isLoading).toBe(false);
  });

  it('reports a sites error with a readable message', async () => {
    service.listSites.mockRejectedValue(new Error('403 Forbidden'));

    const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

    await waitFor(() => expect(result.current.sites.error).toBe('The sites could not be loaded. 403 Forbidden'));
    expect(result.current.sites.items).toEqual([]);
  });

  it('loads the units of the selected site and syncs the state to the host', async () => {
    const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

    act(() => result.current.selectSite('oslo'));

    await waitFor(() => expect(result.current.units.items).toEqual(UNITS));
    expect(service.listUnits).toHaveBeenCalledWith('oslo');
    expect(result.current.selectedSiteId).toBe('oslo');
    expect(syncState).toHaveBeenCalledWith(JSON.stringify({ siteId: 'oslo', unitId: null }));
  });

  it('reports a units error', async () => {
    service.listUnits.mockRejectedValue(new Error('429'));
    const { result } = renderHook(() => useOeeViewModel(), {
      wrapper: makeOeeWrapper({ service, syncState, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });

    await waitFor(() => expect(result.current.units.error).toBe('The units of this site could not be loaded. 429'));
  });

  it('loads the trend of the selected unit up to its latest value', async () => {
    const { result } = renderHook(() => useOeeViewModel(), {
      wrapper: makeOeeWrapper({ service, syncState, initialState: JSON.stringify({ siteId: 'oslo' }) }),
    });
    await waitFor(() => expect(result.current.units.items).toEqual(UNITS));

    act(() => result.current.selectUnit('OSPRPATA241'));

    await waitFor(() => expect(result.current.trend.items).toEqual(TREND));
    expect(service.getOeeTrend).toHaveBeenCalledWith('OSPRPATA241', UPDATED_AT);
    expect(result.current.selectedUnit).toEqual(UNITS[0]);
    expect(syncState).toHaveBeenCalledWith(JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }));
  });

  it('restores the site and unit from the initial state', async () => {
    const { result } = renderHook(() => useOeeViewModel(), {
      wrapper: makeOeeWrapper({
        service,
        syncState,
        initialState: JSON.stringify({ siteId: 'oslo', unitId: 'OSPRFICHSP463' }),
      }),
    });

    await waitFor(() => expect(result.current.selectedUnit).toEqual(UNITS[1]));
    expect(result.current.selectedSiteId).toBe('oslo');
    expect(syncState).not.toHaveBeenCalled();
  });

  it('clears the selected unit when another site is selected', async () => {
    const { result } = renderHook(() => useOeeViewModel(), {
      wrapper: makeOeeWrapper({
        service,
        syncState,
        initialState: JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }),
      }),
    });
    await waitFor(() => expect(result.current.selectedUnit).not.toBeNull());

    act(() => result.current.selectSite('houston'));

    await waitFor(() => expect(service.listUnits).toHaveBeenCalledWith('houston'));
    expect(syncState).toHaveBeenLastCalledWith(JSON.stringify({ siteId: 'houston', unitId: null }));
  });

  it('has no trend for a unit without OEE datapoint', async () => {
    service.listUnits.mockResolvedValue([{ ...UNITS[0], updatedAt: null }]);
    const { result } = renderHook(() => useOeeViewModel(), {
      wrapper: makeOeeWrapper({
        service,
        syncState,
        initialState: JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }),
      }),
    });

    await waitFor(() => expect(result.current.selectedUnit).not.toBeNull());
    expect(result.current.trend).toEqual({ items: [], isLoading: false, error: null });
    expect(service.getOeeTrend).not.toHaveBeenCalled();
  });
});
