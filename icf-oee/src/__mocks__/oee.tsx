import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';

import { OeeDepsContext } from '../oee/oeeDeps';
import type { OeeService } from '../oee/oeeService';
import { OeeStateProvider } from '../oee/OeeStateProvider';
import type { Site, TrendPoint, UnitOee } from '../oee/types';

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

export const TREND: TrendPoint[] = [
  { timestamp: UPDATED_AT - 3600000, oee: 0.4 },
  { timestamp: UPDATED_AT, oee: 0.8 },
];

export type FakeOeeService = {
  [Method in keyof OeeService]: ReturnType<typeof vi.fn<OeeService[Method]>>;
};

export function makeOeeService(): FakeOeeService {
  return {
    listSites: vi.fn<OeeService['listSites']>(() => Promise.resolve(SITES)),
    listUnits: vi.fn<OeeService['listUnits']>(() => Promise.resolve(UNITS)),
    getOeeTrend: vi.fn<OeeService['getOeeTrend']>(() => Promise.resolve(TREND)),
  };
}

type OeeWrapperOptions = {
  service: OeeService;
  syncState?: (serialized: string) => void;
  initialState?: string;
};

/** Providers the OEE view tree needs: query cache (no retry), injected deps and state storage. */
export function makeOeeWrapper({
  service,
  syncState = () => undefined,
  initialState,
}: OeeWrapperOptions): ComponentType<{ children: ReactNode }> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const deps = { service, syncState };

  return function OeeWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OeeDepsContext.Provider value={deps}>
          <OeeStateProvider initialState={initialState}>{children}</OeeStateProvider>
        </OeeDepsContext.Provider>
      </QueryClientProvider>
    );
  };
}
