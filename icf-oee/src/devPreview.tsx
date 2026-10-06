// Development-only visual preview: renders the OEE page with fake data, outside Fusion.
// Open https://localhost:3001/dev-preview.html while `npm run dev` runs. Not part of the build
// (only index.html is bundled). Optional `?state=` query: the JSON of the saved state.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';

import { OeeDepsContext } from './oee/oeeDeps';
import { OeePage } from './oee/OeePage';
import type { OeeService } from './oee/oeeService';
import { OeeStateProvider } from './oee/OeeStateProvider';
import { getTrendRange } from './oee/types';

import './styles.css';

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
    const penalty = siteIndex % 3 === 0 ? 0.3 : siteIndex % 3 === 1 ? 0.12 : 0;
    return Promise.resolve(
      NAMES.map((name, index) => {
        const oee = Math.max(0, OEES[(index + siteIndex) % OEES.length] - penalty);
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
};

const params = new URLSearchParams(window.location.search);
const initialState = params.get('state') ?? undefined;
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <OeeDepsContext.Provider value={{ service, syncState: () => undefined }}>
      <OeeStateProvider initialState={initialState}>
        <OeePage />
      </OeeStateProvider>
    </OeeDepsContext.Provider>
  </QueryClientProvider>
);
