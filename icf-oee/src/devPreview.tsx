// Development-only visual preview: renders the OEE page with fake data, outside Fusion.
// Open https://localhost:3001/dev-preview.html while `npm run dev` runs. Not part of the build
// (only index.html is bundled). Optional `?state=` query: the JSON of the selected site and unit.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';

import { OeeDepsContext } from './oee/oeeDeps';
import { OeePage } from './oee/OeePage';
import type { OeeService } from './oee/oeeService';
import { OeeStateProvider } from './oee/OeeStateProvider';

import './styles.css';

const END = Date.UTC(2026, 9, 5, 19, 0);
const NAMES = ['Aging Tank', 'Balance Tank', 'Brine Flow System', 'Brine Tank', 'Cartoning', 'Chocolate Spray', 'Coding', 'Filling Valves', 'Finished goods', 'Hardening Tunnel', 'Ingredient Doser', 'Lid Dispensing', 'Main Drive, Indexing Chain Conveyor', 'Mix Tank', 'Plate Heat Exchanger', 'Raw materials', 'Sleeve Dispensing', 'Stick Inserter', 'Tray Tunnel Extruder', 'Wet Topping'];
const OEES = [0.955, 0.965, 0, 0.975, 0.972, 0.772, 0.997, 0.883, 0.963, 0.976, 0.796, 0.974, 0.925, 0.729, 0.61, 0.968, 0.987, 0.96, 0.819, 0.953];

const service: OeeService = {
  listSites: () => Promise.resolve([{ externalId: 'oslo', name: 'Oslo' }, { externalId: 'houston', name: 'Houston' }]),
  listUnits: () =>
    Promise.resolve(
      NAMES.map((name, index) => ({
        externalId: `OSPR${name.replace(/[^A-Z]/g, '')}${100 + index}`,
        name,
        oee: OEES[index],
        quality: Math.min(1, OEES[index] + 0.03),
        performance: Math.min(1, OEES[index] + 0.02),
        availability: OEES[index] === 0 ? 0 : 1,
        updatedAt: END - index * 3600000,
      }))
    ),
  getOeeTrend: (_unit, end) =>
    Promise.resolve(
      Array.from({ length: 168 }, (_, hour) => ({
        timestamp: end - (167 - hour) * 3600000,
        oee: hour % 24 === 20 ? 0 : hour % 24 === 21 ? 0.45 : hour % 37 === 5 ? 0.66 : 0.95 + 0.02 * Math.sin(hour),
      }))
    ),
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
