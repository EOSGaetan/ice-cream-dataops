import { connectToHostApp as connectToHostAppImpl } from '@cognite/app-sdk';
import type { HostAppAPI } from '@cognite/app-sdk';
import { CogniteSdkProvider, useCogniteSdk } from '@cognite/app-sdk/react';
// Import per-component, not from the `@cognite/aura/components` barrel: the
// barrel pulls in Aura's whole dependency graph (including large libraries like
// mermaid and shiki), which slows the build and can exhaust memory in CI.
import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Card, CardContent } from '@cognite/aura/components/card';
import { Loader } from '@cognite/aura/components/loader';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { AppErrorBoundary } from './oee/AppErrorBoundary';
import { downloadCsvFile } from './oee/downloadFile';
import { OeeDepsContext } from './oee/oeeDeps';
import { OeePage } from './oee/OeePage';
import { createOeeService } from './oee/oeeService';
import type { OeeCdfClient, OeeService } from './oee/oeeService';
import { OeeStateProvider } from './oee/OeeStateProvider';
import { detectTouchScreen } from './oee/touchScreen';

type AppApi = Pick<HostAppAPI, 'syncInternalState'>;
type AppConnectResult = { api: AppApi; initialState?: string };
type Connection = { status: 'connecting' } | { status: 'failed' } | ({ status: 'connected' } & AppConnectResult);

const loadingFallback = (
  <main className="min-h-screen bg-muted/50 text-foreground">
    <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <Card aria-label="Loading project" aria-live="polite">
          <CardContent>
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <Loader size={20} />
              <span>Loading project...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </main>
);

const errorFallback = (
  <main className="min-h-screen bg-muted/50 text-foreground">
    <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <Alert>
          <AlertDescription>Failed to connect to Fusion host</AlertDescription>
        </Alert>
      </div>
    </section>
  </main>
);

type OeeAppProps = AppConnectResult & {
  createService: (client: OeeCdfClient) => OeeService;
  downloadFile: (fileName: string, content: string) => void;
  isTouchScreen: boolean;
};

/** Wires the OEE page to the authenticated Cognite client and to the Fusion host. */
function OeeApp({ api, initialState, createService, downloadFile, isTouchScreen }: OeeAppProps) {
  const client = useCogniteSdk();
  const deps = useMemo(
    () => ({
      service: createService(client),
      // Writes to the ?customAppInternalState search param so the URL is bookmarkable/shareable.
      syncState: (serialized: string) => void api.syncInternalState(serialized),
      downloadFile,
      isTouchScreen,
    }),
    [api, client, createService, downloadFile, isTouchScreen]
  );

  return (
    <OeeDepsContext.Provider value={deps}>
      <OeeStateProvider initialState={initialState}>
        <AppErrorBoundary>
          <OeePage />
        </AppErrorBoundary>
      </OeeStateProvider>
    </OeeDepsContext.Provider>
  );
}

type AppProps = {
  deps?: ComponentProps<typeof CogniteSdkProvider>['deps'];
  connectToHostApp?: () => Promise<AppConnectResult>;
  createService?: (client: OeeCdfClient) => OeeService;
  downloadFile?: (fileName: string, content: string) => void;
  isTouchScreen?: boolean;
};

function App({
  deps,
  connectToHostApp = deps?.connectToHostApp ?? connectToHostAppImpl,
  createService = createOeeService,
  downloadFile = downloadCsvFile,
  isTouchScreen = detectTouchScreen(),
}: AppProps) {
  const [connection, setConnection] = useState<Connection>({ status: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    connectToHostApp().then(
      (result) => {
        if (!cancelled) setConnection({ status: 'connected', api: result.api, initialState: result.initialState });
      },
      () => {
        if (!cancelled) setConnection({ status: 'failed' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [connectToHostApp]);

  if (connection.status === 'failed') return errorFallback;

  return (
    <CogniteSdkProvider loadingFallback={loadingFallback} errorFallback={errorFallback} deps={deps}>
      {connection.status === 'connected' ? (
        <OeeApp
          api={connection.api}
          initialState={connection.initialState}
          createService={createService}
          downloadFile={downloadFile}
          isTouchScreen={isTouchScreen}
        />
      ) : (
        loadingFallback
      )}
    </CogniteSdkProvider>
  );
}

export default App;
