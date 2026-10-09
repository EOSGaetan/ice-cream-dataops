import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper, SITES, TREND, UNIT_STATS, UNITS, UPDATED_AT } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { useOeeSelection } from './useOeeSelection';
import { useSiteDetailViewModel } from './useSiteDetailViewModel';
import { useSitesOverviewViewModel } from './useSitesOverviewViewModel';
import { useUnitTypesViewModel } from './useUnitTypesViewModel';

/** The selection and the view models of the three tabs together, as the page uses them. */
function useOeeViewModel() {
  return {
    ...useOeeSelection(),
    ...useSitesOverviewViewModel(),
    ...useUnitTypesViewModel(),
    ...useSiteDetailViewModel(),
  };
}

const OSLO = JSON.stringify({ view: 'site', siteId: 'oslo' });
const UNIT_TYPES = JSON.stringify({ view: 'units' });
const OSLO_BALANCE_TANK = JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241' });

describe(useOeeViewModel.name, () => {
  let service: FakeOeeService;
  let syncState: ReturnType<typeof vi.fn<(serialized: string) => void>>;

  beforeEach(() => {
    service = makeOeeService();
    syncState = vi.fn<(serialized: string) => void>();
  });

  it('starts on the overview, loading the sites, with nothing selected', () => {
    service.listSites.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

    expect(result.current.view).toBe('overview');
    expect(result.current.sites).toEqual({ items: [], isLoading: true, error: null });
    expect(result.current.overview).toEqual({ items: [], isLoading: true, error: null });
    expect(result.current.selectedSiteId).toBeNull();
    expect(result.current.trendRange).toBe('1w');
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
    expect(result.current.overview.error).toBe('The sites could not be loaded. 403 Forbidden');
  });

  describe('overview', () => {
    it('summarizes every site with its three lowest units', async () => {
      const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

      await waitFor(() => expect(result.current.overview.items.every((site) => site.summary !== null)).toBe(true));
      await waitFor(() => expect(result.current.overview.items).toHaveLength(2));

      expect(service.listAllUnits).toHaveBeenCalledTimes(1);
      expect(service.listUnits).not.toHaveBeenCalled();
      const oslo = result.current.overview.items[1];
      expect(oslo.site).toEqual(SITES[1]);
      expect(oslo.summary?.unitCount).toBe(2);
      expect(oslo.lowestUnits.map((unit) => unit.name)).toEqual(['Chocolate Spray', 'Balance Tank']);
      expect(oslo.isLoading).toBe(false);
      expect(oslo.error).toBeNull();
    });

    it('marks the sites as loading until the units arrive', async () => {
      service.listAllUnits.mockReturnValue(new Promise(() => undefined));

      const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

      await waitFor(() => expect(result.current.overview.items).toHaveLength(2));
      expect(result.current.overview.items[0]).toEqual({
        site: SITES[0],
        summary: null,
        lowestUnits: [],
        isLoading: true,
        error: null,
      });
    });

    it('reports an error of the units on every site', async () => {
      service.listAllUnits.mockRejectedValue(new Error('429'));

      const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });

      await waitFor(() =>
        expect(result.current.overview.items[0]?.error).toBe('The units could not be loaded. 429')
      );
      expect(result.current.overview.items[1]?.error).toBe('The units could not be loaded. 429');
      expect(result.current.overview.items[1]?.summary).toBeNull();
    });

    it('opens a site in the site tab and syncs the state to the host', async () => {
      const { result } = renderHook(() => useOeeViewModel(), { wrapper: makeOeeWrapper({ service, syncState }) });
      await waitFor(() => expect(result.current.sites.items).toEqual(SITES));

      act(() => result.current.openSite('oslo'));

      await waitFor(() => expect(result.current.units.items).toEqual(UNITS));
      expect(result.current.view).toBe('site');
      expect(result.current.selectedSiteId).toBe('oslo');
      expect(result.current.overview.items).toEqual([]);
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: null, unitType: null, range: '1w' })
      );
    });

    it('switches between the tabs and keeps the selection', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO_BALANCE_TANK }),
      });
      await waitFor(() => expect(result.current.selectedUnit).not.toBeNull());

      act(() => result.current.selectView('overview'));

      expect(result.current.view).toBe('overview');
      expect(syncState).toHaveBeenLastCalledWith(
        JSON.stringify({ view: 'overview', siteId: 'oslo', unitId: 'OSPRPATA241', unitType: null, range: '1w' })
      );
    });
  });

  describe('unit types', () => {
    it('is loading until the units of every site and their OEE statistics arrive', async () => {
      service.getUnitOeeStats.mockReturnValue(new Promise(() => undefined));

      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });

      expect(result.current.unitTypes).toEqual({ items: [], isLoading: true, error: null });
      await waitFor(() => expect(service.getUnitOeeStats).toHaveBeenCalled());
      expect(result.current.unitTypes.isLoading).toBe(true);
      expect(service.getUnitComponentMeans).not.toHaveBeenCalled();
    });

    it('asks for the statistics of every unit over the time frame that ends at the latest value', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });

      await waitFor(() => expect(result.current.unitTypes.items).toHaveLength(2));
      const unitIds = ['OSPRPATA241', 'OSPRFICHSP463', 'OSPRPATA241', 'OSPRFICHSP463'];
      expect(service.listAllUnits).toHaveBeenCalledTimes(1);
      expect(service.listUnits).not.toHaveBeenCalled();
      expect(service.getUnitOeeStats).toHaveBeenCalledWith(unitIds, UPDATED_AT, '1w');
      await waitFor(() => expect(service.getUnitComponentMeans).toHaveBeenCalledWith(unitIds, UPDATED_AT, '1w'));
    });

    it('ranks the unit types of all sites: most time below the alert threshold first', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });

      await waitFor(() => expect(result.current.unitTypes.items).toHaveLength(2));
      await waitFor(() => expect(result.current.isLoadingUnitTypeDetails).toBe(false));
      const [first, second] = result.current.unitTypes.items;
      expect(first.name).toBe('Chocolate Spray');
      expect(first.belowAlertShare).toBeCloseTo(0.5);
      expect(first.unitCount).toBe(2);
      expect(first.siteCount).toBe(2);
      expect(first.members.map((member) => member.stats)).toEqual([UNIT_STATS[1], UNIT_STATS[1]]);
      expect(second.name).toBe('Balance Tank');
      expect(second.meanOee).toBeCloseTo(0.8);
      expect(result.current.unitTypes.isLoading).toBe(false);
      expect(result.current.selectedUnitType).toBeNull();
    });

    it('shows the ranking first, then the mean quality, performance and availability', async () => {
      let sendComponents: () => void = () => undefined;
      service.getUnitComponentMeans.mockReturnValue(
        new Promise((resolve) => {
          sendComponents = () =>
            resolve([{ externalId: 'OSPRPATA241', quality: 0.9, performance: 0.95, availability: 0.9 }]);
        })
      );
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });

      await waitFor(() => expect(result.current.unitTypes.items).toHaveLength(2));
      expect(result.current.unitTypes.isLoading).toBe(false);
      expect(result.current.isLoadingUnitTypeDetails).toBe(true);
      expect(result.current.unitTypes.items[1]).toMatchObject({ name: 'Balance Tank', quality: null });

      act(() => sendComponents());

      await waitFor(() => expect(result.current.isLoadingUnitTypeDetails).toBe(false));
      expect(result.current.unitTypes.items[1].quality).toBeCloseTo(0.9);
    });

    it('reports an error of the statistics', async () => {
      service.getUnitOeeStats.mockRejectedValue(new Error('500'));

      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });

      await waitFor(() =>
        expect(result.current.unitTypes).toEqual({
          items: [],
          isLoading: false,
          error: 'The unit statistics could not be loaded. 500',
        })
      );
    });

    it('reports an error of the units', async () => {
      service.listAllUnits.mockRejectedValue(new Error('429'));

      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });

      await waitFor(() => expect(result.current.unitTypes.error).toBe('The unit statistics could not be loaded. 429'));
      expect(result.current.unitTypes.isLoading).toBe(false);
      expect(service.getUnitOeeStats).not.toHaveBeenCalled();
    });

    it('selects a unit type and syncs the state to the host', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });
      await waitFor(() => expect(result.current.unitTypes.items).toHaveLength(2));

      act(() => result.current.selectUnitType('Balance Tank'));

      expect(result.current.selectedUnitType?.name).toBe('Balance Tank');
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'units', siteId: null, unitId: null, unitType: 'Balance Tank', range: '1w' })
      );
    });

    it('reloads the statistics when another time frame is selected', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: UNIT_TYPES }),
      });
      await waitFor(() => expect(result.current.unitTypes.items).toHaveLength(2));

      act(() => result.current.selectTrendRange('1m'));

      await waitFor(() =>
        expect(service.getUnitOeeStats).toHaveBeenCalledWith(expect.any(Array), UPDATED_AT, '1m')
      );
    });

    it('opens a unit of a type in the site tab', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({
          service,
          syncState,
          initialState: JSON.stringify({ view: 'units', unitType: 'Balance Tank' }),
        }),
      });
      await waitFor(() => expect(result.current.selectedUnitType?.name).toBe('Balance Tank'));

      act(() => result.current.openUnit('oslo', 'OSPRPATA241'));

      await waitFor(() => expect(result.current.selectedUnit).toEqual(UNITS[0]));
      expect(result.current.view).toBe('site');
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', unitType: 'Balance Tank', range: '1w' })
      );
    });
  });

  describe('site', () => {
    it('loads the units of the selected site and syncs the state to the host', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: JSON.stringify({ view: 'site' }) }),
      });

      act(() => result.current.selectSite('oslo'));

      await waitFor(() => expect(result.current.units.items).toEqual(UNITS));
      expect(service.listUnits).toHaveBeenCalledWith('oslo');
      expect(result.current.selectedSiteId).toBe('oslo');
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: null, unitType: null, range: '1w' })
      );
    });

    it('reports a units error', async () => {
      service.listUnits.mockRejectedValue(new Error('429'));
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO }),
      });

      await waitFor(() => expect(result.current.units.error).toBe('The units of this site could not be loaded. 429'));
    });

    it('loads the 1-week trend of the selected unit up to its latest value', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO }),
      });
      await waitFor(() => expect(result.current.units.items).toEqual(UNITS));

      act(() => result.current.selectUnit('OSPRPATA241'));

      await waitFor(() => expect(result.current.trend.items).toEqual(TREND));
      expect(service.getOeeTrend).toHaveBeenCalledWith('OSPRPATA241', UPDATED_AT, '1w');
      expect(result.current.selectedUnit).toEqual(UNITS[0]);
      expect(syncState).toHaveBeenCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', unitType: null, range: '1w' })
      );
    });

    it('reloads the trend when another time frame is selected', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO_BALANCE_TANK }),
      });
      await waitFor(() => expect(result.current.trend.items).toEqual(TREND));

      act(() => result.current.selectTrendRange('1y'));

      await waitFor(() => expect(service.getOeeTrend).toHaveBeenCalledWith('OSPRPATA241', UPDATED_AT, '1y'));
      expect(result.current.trendRange).toBe('1y');
      expect(syncState).toHaveBeenLastCalledWith(
        JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', unitType: null, range: '1y' })
      );
    });

    it('restores the site, the unit and the time frame from the initial state', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({
          service,
          syncState,
          initialState: JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRFICHSP463', unitType: null, range: '1m' }),
        }),
      });

      await waitFor(() => expect(result.current.selectedUnit).toEqual(UNITS[1]));
      expect(result.current.selectedSiteId).toBe('oslo');
      expect(result.current.trendRange).toBe('1m');
      await waitFor(() => expect(service.getOeeTrend).toHaveBeenCalledWith('OSPRFICHSP463', UPDATED_AT, '1m'));
      expect(syncState).not.toHaveBeenCalled();
    });

    it('clears the selected unit when another site is selected', async () => {
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO_BALANCE_TANK }),
      });
      await waitFor(() => expect(result.current.selectedUnit).not.toBeNull());

      act(() => result.current.selectSite('houston'));

      await waitFor(() => expect(service.listUnits).toHaveBeenCalledWith('houston'));
      expect(syncState).toHaveBeenLastCalledWith(
        JSON.stringify({ view: 'site', siteId: 'houston', unitId: null, unitType: null, range: '1w' })
      );
    });

    it('has no trend for a unit without OEE datapoint', async () => {
      service.listUnits.mockResolvedValue([{ ...UNITS[0], updatedAt: null }]);
      const { result } = renderHook(() => useOeeViewModel(), {
        wrapper: makeOeeWrapper({ service, syncState, initialState: OSLO_BALANCE_TANK }),
      });

      await waitFor(() => expect(result.current.selectedUnit).not.toBeNull());
      expect(result.current.trend).toEqual({ items: [], isLoading: false, error: null });
      expect(service.getOeeTrend).not.toHaveBeenCalled();
    });
  });
});
