# File inventory: Ice Cream Factory OEE (round 1)

Scope: every `.ts` / `.tsx` under `src/` (no `node_modules`, `dist`, `.cognite-bundles`), plus the
test and build configuration. Every non-trivial production file was read.
Legend: ✓ meets the bar, ~ minor gap, ✗ gap, – not applicable.

| File | Lines | Structure | Quality | Patterns | Tests | Notes |
| ---- | ----- | --------- | ------- | -------- | ----- | ----- |
| `vitest.config.ts` | 17 | ✓ | ✗ | – | – | `coverage.exclude` lists `src/devPreview.tsx`: a file under `src/` hidden from the measurement |
| `vite.config.ts` | 28 | ✓ | ✓ | – | – | No `test` block; CSP, HTTPS and Fusion plugins from the template |
| `src/main.tsx` | 24 | ✓ | ✓ | ✓ | – | Bootstrap only (allowed outside coverage) |
| `src/App.tsx` | 128 | ✓ | ~ | ✓ | ✓ | Connects to the host, wires the dependencies; no ErrorBoundary around the page |
| `src/devPreview.tsx` | 113 | ✗ | ~ | – | ✗ | Development-only page with fake data, lives in `src/` and is excluded from coverage |
| `src/lib/utils.ts` | 6 | ✗ | ✗ | – | ✗ | Template helper `cn`, imported nowhere: unused file |
| `src/vite-env.d.ts` | 1 | ✓ | ✓ | – | – | Type reference only |
| `src/__mocks__/oee.tsx` | 115 | ✓ | ✓ | ✓ | – | Shared test doubles and provider wrapper |
| `src/shared/utils/semaphore.ts` | 38 | ✓ | ✓ | ✓ | ✓ | `QueuedTaskRunner`, cap of 15 concurrent CDF requests |
| `src/oee/types.ts` | 109 | ✓ | ✓ | ✓ | ✓ (through users) | Domain types, thresholds, time frames |
| `src/oee/oeeService.ts` | 372 | ~ | ~ | ✓ | ✓ | Interface + class, narrow SDK client, injected runner; one class with five read methods |
| `src/oee/oeeExport.ts` | 198 | ✓ | ✓ | ✓ | ✓ | Pure: export plan, CSV building, formats |
| `src/oee/oeeFormat.ts` | 43 | ✓ | ✓ | ✓ | ✓ | Pure formatters |
| `src/oee/oeeKpi.ts` | 55 | ✓ | ✓ | ✓ | ✓ | Pure: levels, site summary |
| `src/oee/unitTypes.ts` | 120 | ✓ | ✓ | ✓ | ✓ | Pure: grouping and ranking |
| `src/oee/siteLocations.ts` | 58 | ✓ | ✓ | ✓ | ✓ | Site coordinates, map projection |
| `src/oee/worldMap.ts` | 10 | ✓ | ✓ | – | – | Generated SVG path (constants) |
| `src/oee/downloadFile.ts` | 17 | ✓ | ~ | ~ | ✓ | Browser adapter; calls `window.setTimeout` directly |
| `src/oee/oeeDeps.ts` | 22 | ✓ | ✓ | ✓ | ✓ (through users) | Dependency context: service, host sync, download |
| `src/oee/oeeState.ts` | 58 | ✓ | ✓ | ✓ | ✓ | Host-synced state, guarded parsing |
| `src/oee/exportForm.ts` | 53 | ✓ | ✓ | ✓ | ✓ (through users) | Export form storage context |
| `src/oee/OeeStateProvider.tsx` | 19 | ✓ | ✓ | ✓ | ✓ (through users) | State storage |
| `src/oee/ExportStorageProvider.tsx` | 14 | ✓ | ✓ | ✓ | ✓ (through users) | State storage |
| `src/oee/useSiteUnits.ts` | 47 | ✓ | ✓ | ✓ | ✓ (through users) | Shared queries, service from context |
| `src/oee/useOeeViewModel.ts` | 207 | ✓ | ~ | ✓ | ✓ | ViewModel, no local state; long, three tabs in one hook |
| `src/oee/useExportViewModel.ts` | 206 | ✓ | ✓ | ✓ | ✓ | ViewModel for the export tab |
| `src/oee/OeePage.tsx` | 76 | ✓ | ✓ | ✓ | ✓ | Page shell and tabs |
| `src/oee/SitesOverview.tsx` | 49 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/SitesMap.tsx` | 98 | ✓ | ~ | ✓ | ✓ (page tests) | Custom map (no Aura equivalent); marker hit area 28 px |
| `src/oee/SiteLowestUnits.tsx` | 40 | ✓ | ✓ | ✓ | ~ | Hover card content, not asserted directly |
| `src/oee/OverviewTable.tsx` | 79 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/UnitTypesView.tsx` | 143 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/UnitTypesChart.tsx` | 48 | ✓ | ✓ | ✓ | ~ | Chart, asserted by its accessible name only |
| `src/oee/UnitTypesTable.tsx` | 105 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/UnitTypeDetail.tsx` | 54 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/SiteDetail.tsx` | 174 | ~ | ✓ | ✓ | ✓ (page tests) | Over 150 lines, render only (no fetching) |
| `src/oee/SiteSelect.tsx` | 49 | ✓ | ✓ | ✓ | ~ | Selection through the Aura Select is not exercised in tests |
| `src/oee/SiteKpiTiles.tsx` | 54 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/UnitTable.tsx` | 82 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/OeeTrendChart.tsx` | 79 | ✓ | ✓ | ✓ | ~ | Chart, asserted by its accessible name only |
| `src/oee/TrendRangeControl.tsx` | 35 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura SegmentedControl |
| `src/oee/ExportView.tsx` | 234 | ~ | ✓ | ✓ | ✓ (page tests) | Over 150 lines, render only; one form |
| `src/oee/OeeValue.tsx` | 30 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura Badge |
| `src/oee/OeeStates.tsx` | 30 | ✓ | ✓ | ✓ | ✓ (page tests) | Loading, error, empty |
| `src/oee/SelectableName.tsx` | 24 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |

Test files (13): `App.test.tsx`, `oee/OeePage.test.tsx`, `oee/useOeeViewModel.test.tsx`,
`oee/useExportViewModel.test.tsx`, `oee/oeeService.test.ts`, `oee/oeeExport.test.ts`,
`oee/oeeFormat.test.ts`, `oee/oeeKpi.test.ts`, `oee/oeeState.test.ts`, `oee/unitTypes.test.ts`,
`oee/siteLocations.test.ts`, `oee/downloadFile.test.ts`, `shared/utils/semaphore.test.ts`.

Structure note (code-quality step 9): the app uses one feature folder `src/oee/` with PascalCase
component files and camelCase modules, not the `components/ hooks/ utils/ contexts/ views/ types/`
layout with kebab-case file names that the skill describes.
