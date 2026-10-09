// Development-only visual preview: renders the OEE page with fake data, outside Fusion.
// Open https://localhost:3001/dev-preview.html while `npm run dev` runs. Not part of the build
// (only index.html is bundled). Optional `?state=` query: the JSON of the saved state.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';

import { downloadCsvFile } from '../src/oee/downloadFile';
import { OeeDepsContext } from '../src/oee/oeeDeps';
import { getExportStep } from '../src/oee/oeeExport';
import { OeePage } from '../src/oee/OeePage';
import type { OeeService } from '../src/oee/oeeService';
import { OeeStateProvider } from '../src/oee/OeeStateProvider';
import { detectTouchScreen } from '../src/oee/touchScreen';
import { getTrendRange } from '../src/oee/types';

import '../src/styles.css';

const END = Date.UTC(2026, 9, 5, 19, 0);
const SITES = [
  { externalId: 'chicago', name: 'Chicago' },
  { externalId: 'hannover', name: 'Hannover' },
  { externalId: 'houston', name: 'Houston' },
  { externalId: 'kuala_lumpur', name: 'Kuala Lumpur' },
  { externalId: 'london', name: 'London' },
  { externalId: 'marseille', name: 'Marseille' },
  { externalId: 'nuremberg', name: 'Nuremberg' },
  { externalId: 'oslo', name: 'Oslo' },
  { externalId: 'rotterdam', name: 'Rotterdam' },
  { externalId: 'sao_paulo', name: 'Sao Paulo' },
];
const NAMES = ['Aging Tank', 'Balance Tank', 'Brine Flow System', 'Brine Tank', 'Cartoning', 'Chocolate Spray', 'Coding', 'Filling Valves', 'Finished goods', 'Hardening Tunnel', 'Ingredient Doser', 'Lid Dispensing', 'Main Drive, Indexing Chain Conveyor', 'Mix Tank', 'Plate Heat Exchanger', 'Raw materials', 'Sleeve Dispensing', 'Stick Inserter', 'Tray Tunnel Extruder', 'Wet Topping'];
const OEES = [0.955, 0.965, 0, 0.975, 0.972, 0.772, 0.997, 0.883, 0.963, 0.976, 0.796, 0.974, 0.925, 0.729, 0.61, 0.968, 0.987, 0.96, 0.819, 0.953];

const service: OeeService = {
  listSites: () => Promise.resolve(SITES),
  listUnits: (siteId) => {
    // Each site gets a different level, so the map shows the three marker colours.
    const siteIndex = SITES.findIndex((site) => site.externalId === siteId);
    const penalty = siteIndex % 3 === 0 ? 0.3 : siteIndex % 3 === 1 ? 0.03 : -0.08;
    return Promise.resolve(
      NAMES.map((name, index) => {
        const oee = Math.min(1, Math.max(0, OEES[(index + siteIndex) % OEES.length] - penalty));
        return {
          externalId: `${siteId.slice(0, 2).toUpperCase()}PR${name.replace(/[^A-Z]/g, '')}${100 + index}`,
          name,
          oee,
          quality: Math.min(1, oee + 0.03),
          performance: Math.min(1, oee + 0.02),
          availability: oee === 0 ? 0 : 1,
          updatedAt: END - index * 3600000,
        };
      })
    );
  },
  listAllUnits: async () => {
    const bySite = await Promise.all(
      SITES.map(async (site) => (await service.listUnits(site.externalId)).map((unit) => ({ site, unit })))
    );
    return bySite.flat();
  },
  getOeeTrend: (_unit, end, rangeId) => {
    const range = getTrendRange(rangeId);
    const stepMs = range.id === '1w' ? 3600000 : range.id === '1m' ? 4 * 3600000 : 24 * 3600000;
    const count = Math.round(range.windowMs / stepMs);
    return Promise.resolve(
      Array.from({ length: count }, (_, step) => ({
        timestamp: end - (count - 1 - step) * stepMs,
        oee: step % 24 === 20 ? 0 : step % 24 === 21 ? 0.45 : step % 37 === 5 ? 0.66 : 0.95 + 0.02 * Math.sin(step),
      }))
    );
  },
  getUnitOeeStats: (unitIds) =>
    Promise.resolve(
      unitIds.map((externalId, index) => {
        // The trailing number of the fake external id is the unit type: same type, similar figures.
        const type = Number(externalId.slice(-3)) - 100;
        const share = Math.max(0, 0.45 - type * 0.03 + (index % 7) * 0.01);
        return {
          externalId,
          meanOee: 1 - share * 0.8,
          periods: 160,
          periodsBelowAlert: Math.round(share * 160),
        };
      })
    ),
  getUnitComponentMeans: (unitIds) =>
    // Later than the ranking, to show the columns filling in afterwards.
    new Promise((resolve) => {
      window.setTimeout(() => {
        resolve(
          unitIds.map((externalId) => {
            const share = Math.max(0, 0.45 - (Number(externalId.slice(-3)) - 100) * 0.03);
            return {
              externalId,
              quality: 1 - share * 0.3,
              performance: 1 - share * 0.2,
              availability: 1 - share * 0.4,
            };
          })
        );
      }, 1500);
    }),
  exportAverages: ({ unitExternalIds, metrics, startMs, endMs, stepId }, onProgress) => {
    const stepMs = getExportStep(stepId).stepMs;
    const count = Math.ceil((endMs - startMs) / stepMs);
    onProgress?.(1, 1);
    return Promise.resolve(
      unitExternalIds.flatMap((unitExternalId, unitIndex) =>
        metrics.map((metric, metricIndex) => ({
          unitExternalId,
          metric,
          points: Array.from({ length: count }, (_, step) => ({
            timestamp: startMs + step * stepMs,
            value: Math.max(0, 0.95 - metricIndex * 0.02 - (unitIndex % 5) * 0.05 - (step % 24 === 20 ? 0.9 : 0)),
          })),
        }))
      )
    );
  },
};

const params = new URLSearchParams(window.location.search);
const initialState = params.get('state') ?? undefined;
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <OeeDepsContext.Provider
      value={{
        service,
        syncState: () => undefined,
        downloadFile: downloadCsvFile,
        isTouchScreen: detectTouchScreen(),
      }}
    >
      <OeeStateProvider initialState={initialState}>
        <OeePage />
      </OeeStateProvider>
    </OeeDepsContext.Provider>
  </QueryClientProvider>
);
