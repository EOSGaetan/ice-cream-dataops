import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';

import { ExportStorageProvider } from '../oee/ExportStorageProvider';
import { OeeDepsContext } from '../oee/oeeDeps';
import type { ExportSeries } from '../oee/oeeExport';
import type { OeeService } from '../oee/oeeService';
import { OeeStateProvider } from '../oee/OeeStateProvider';
import type { Site, SiteUnit, TrendPoint, UnitOee, UnitPeriodStats } from '../oee/types';

export const UPDATED_AT = Date.UTC(2026, 9, 4, 12, 0);

export const SITES: Site[] = [
  { externalId: 'houston', name: 'Houston' },
  { externalId: 'oslo', name: 'Oslo' },
];

export const UNITS: UnitOee[] = [
  {
    externalId: 'OSPRPATA241',
    name: 'Balance Tank',
    oee: 0.828,
    quality: 0.95,
    performance: 0.98,
    availability: 0.89,
    updatedAt: UPDATED_AT,
  },
  {
    externalId: 'OSPRFICHSP463',
    name: 'Chocolate Spray',
    oee: 0.7717,
    quality: 0.8063,
    performance: 0.9571,
    availability: 1,
    updatedAt: UPDATED_AT,
  },
];

/**
 * Every site has the same two units in these tests: four units in all. As in the real read, only
 * the latest OEE is known here.
 */
export const ALL_UNITS: SiteUnit[] = SITES.flatMap((site) =>
  UNITS.map((unit) => ({ site, unit: { ...unit, quality: null, performance: null, availability: null } }))
);

export const TREND: TrendPoint[] = [
  { timestamp: UPDATED_AT - 3600000, oee: 0.4 },
  { timestamp: UPDATED_AT, oee: 0.8 },
];

/** Over the time frame: Balance Tank spends 25% of the periods below the alert threshold, Chocolate Spray 50%. */
export const UNIT_STATS: UnitPeriodStats[] = [
  {
    externalId: 'OSPRPATA241',
    meanOee: 0.8,
    periods: 100,
    periodsBelowAlert: 25,
    quality: 0.9,
    performance: 0.95,
    availability: 0.9,
  },
  {
    externalId: 'OSPRFICHSP463',
    meanOee: 0.6,
    periods: 100,
    periodsBelowAlert: 50,
    quality: 0.7,
    performance: 0.9,
    availability: 0.95,
  },
];

/** One hourly OEE average for each of the two units. */
export const EXPORT_SERIES: ExportSeries[] = [
  { unitExternalId: 'OSPRPATA241', metric: 'oee', points: [{ timestamp: UPDATED_AT, value: 0.8 }] },
  { unitExternalId: 'OSPRFICHSP463', metric: 'oee', points: [{ timestamp: UPDATED_AT, value: 0.6 }] },
];

export type FakeOeeService = {
  [Method in keyof OeeService]: ReturnType<typeof vi.fn<OeeService[Method]>>;
};

export function makeOeeService(): FakeOeeService {
  return {
    listSites: vi.fn<OeeService['listSites']>(() => Promise.resolve(SITES)),
    listUnits: vi.fn<OeeService['listUnits']>(() => Promise.resolve(UNITS)),
    getOeeTrend: vi.fn<OeeService['getOeeTrend']>(() => Promise.resolve(TREND)),
    listAllUnits: vi.fn<OeeService['listAllUnits']>(() => Promise.resolve(ALL_UNITS)),
    getUnitOeeStats: vi.fn<OeeService['getUnitOeeStats']>(() =>
      Promise.resolve(
        UNIT_STATS.map(({ externalId, meanOee, periods, periodsBelowAlert }) => ({
          externalId,
          meanOee,
          periods,
          periodsBelowAlert,
        }))
      )
    ),
    getUnitComponentMeans: vi.fn<OeeService['getUnitComponentMeans']>(() =>
      Promise.resolve(
        UNIT_STATS.map(({ externalId, quality, performance, availability }) => ({
          externalId,
          quality,
          performance,
          availability,
        }))
      )
    ),
    exportAverages: vi.fn<OeeService['exportAverages']>(() => Promise.resolve(EXPORT_SERIES)),
  };
}

type OeeWrapperOptions = {
  service: OeeService;
  syncState?: (serialized: string) => void;
  downloadFile?: (fileName: string, content: string) => void;
  isTouchScreen?: boolean;
  initialState?: string;
};

/** Providers the OEE view tree needs: query cache (no retry), injected deps and state storage. */
export function makeOeeWrapper({
  service,
  syncState = () => undefined,
  downloadFile = () => undefined,
  isTouchScreen = false,
  initialState,
}: OeeWrapperOptions): ComponentType<{ children: ReactNode }> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const deps = { service, syncState, downloadFile, isTouchScreen };

  return function OeeWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OeeDepsContext.Provider value={deps}>
          <OeeStateProvider initialState={initialState}>
            <ExportStorageProvider>{children}</ExportStorageProvider>
          </OeeStateProvider>
        </OeeDepsContext.Provider>
      </QueryClientProvider>
    );
  };
}
