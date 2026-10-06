import type { HostAppAPI, ConnectToHostAppResult } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService } from './__mocks__/oee';
import App from './App';

type AppDeps = NonNullable<ComponentProps<typeof App>['deps']>;

type AppApi = Pick<HostAppAPI, 'syncInternalState'>;

function makeApi(): AppApi {
  return {
    syncInternalState: vi.fn<HostAppAPI['syncInternalState']>(() => Promise.resolve(true)),
  };
}

function makeDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() =>
      Promise.resolve({
        api: {
          getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('cdf-bootcamp-33-test')),
          getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() => Promise.resolve('https://cognite.test')),
          getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
          getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('test-app-id')),
        } as Partial<HostAppAPI> as HostAppAPI,
      })
    ),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function makeLoadingDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() => new Promise<ConnectToHostAppResult>(() => undefined)),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function renderApp(props: ComponentProps<typeof App>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<App {...props} />, { wrapper });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    renderApp({ deps: makeLoadingDeps(), connectToHostApp: () => new Promise<never>(() => undefined) });

    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('renders the connection error when the Fusion host cannot be reached', async () => {
    renderApp({ deps: makeDeps(), connectToHostApp: () => Promise.reject(new Error('no host')) });

    await waitFor(() => expect(screen.getByText('Failed to connect to Fusion host')).toBeInTheDocument());
  });

  it('renders the OEE page with the sites read through the service', async () => {
    const service = makeOeeService();
    const createService = vi.fn(() => service);

    renderApp({
      deps: makeDeps(),
      connectToHostApp: () => Promise.resolve({ api: makeApi() }),
      createService,
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ice Cream Factory OEE' })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(createService).toHaveBeenCalledWith(expect.any(CogniteClient));
    expect(service.listSites).toHaveBeenCalled();
  });

  it('restores the selected site and unit from the initial state', async () => {
    const service = makeOeeService();

    renderApp({
      deps: makeDeps(),
      connectToHostApp: () =>
        Promise.resolve({
          api: makeApi(),
          initialState: JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }),
        }),
      createService: () => service,
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'OEE trend of Balance Tank' })).toBeInTheDocument()
    );
    expect(service.listUnits).toHaveBeenCalledWith('oslo');
  });
});
