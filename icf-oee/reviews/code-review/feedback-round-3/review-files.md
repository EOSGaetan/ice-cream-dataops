# File inventory: Ice Cream Factory OEE (round 3)

Scope: every `.ts` / `.tsx` under `src/` (no `node_modules`, `dist`, `.cognite-bundles`), plus the
test and build configuration and the development preview. Version 0.0.10.
Legend: ✓ meets the bar, ~ minor gap, ✗ gap, – not applicable. "Page tests" means the file is
exercised through `OeePage` in the test suite.

| File | Lines | Structure | Quality | Patterns | Tests | Notes |
| ---- | ----- | --------- | ------- | -------- | ----- | ----- |
| `vitest.config.ts` | 19 | ✓ | ✓ | – | – | Coverage on all of `src/`; no production file excluded |
| `vite.config.ts` | 28 | ✓ | ✓ | – | – | CSP, HTTPS and Fusion plugins from the template |
| `dev/devPreview.tsx` | 157 | ✓ | ✓ | – | – | Development-only page with fake data, outside `src/`, not bundled |
| `src/main.tsx` | 24 | ✓ | ✓ | ✓ | – | Bootstrap only (allowed outside coverage) |
| `src/App.tsx` | 142 | ✓ | ✓ | ✓ | ✓ | Host connection, dependency wiring, `AppErrorBoundary` around the page |
| `src/config/model.ts` | 27 | ✓ | ✓ | ✓ | ✓ | **New.** Every identifier of the data model, in one place |
| `src/__mocks__/oee.tsx` | 160 | ✓ | ✓ | ✓ | – | Shared test doubles and provider wrapper |
| `src/shared/utils/semaphore.ts` | 38 | ✓ | ✓ | ✓ | ✓ | `QueuedTaskRunner`, cap of 15 concurrent CDF requests |
| `src/oee/types.ts` | 123 | ✓ | ✓ | ✓ | ✓ (through users) | Domain types, thresholds, time frames |
| `src/oee/schema.ts` | 44 | ✓ | ✓ | ✓ | ✓ | **New.** Zod parse of an asset instance where it enters the app |
| `src/oee/oeeService.ts` | 444 | ~ | ✓ | ✓ | ✓ | Interface + class, narrow SDK client, injected runner. One class with eight read methods: long, one responsibility (reads of the OEE data) |
| `src/oee/oeeErrors.ts` | 23 | ✓ | ✓ | ✓ | ✓ | Plain words for the usual CDF answers |
| `src/oee/oeeRegions.ts` | 41 | ✓ | ✓ | ✓ | ✓ (through users) | **New.** `DataRegion`, `SiteOverview`, region helpers |
| `src/oee/oeeExport.ts` | 198 | ✓ | ✓ | ✓ | ✓ | Pure: export plan, CSV building, formats |
| `src/oee/weeklyReport.ts` | 368 | ~ | ✓ | ✓ | ✓ | Pure: report model and its HTML file. Long: the two could be two files |
| `src/oee/oeeFormat.ts` | 48 | ✓ | ✓ | ✓ | ✓ | Pure formatters |
| `src/oee/oeeKpi.ts` | 69 | ✓ | ✓ | ✓ | ✓ | Pure: unit level, site level, site summary |
| `src/oee/unitTypes.ts` | 120 | ✓ | ✓ | ✓ | ✓ | Pure: grouping and ranking |
| `src/oee/siteLocations.ts` | 58 | ✓ | ✓ | ✓ | ✓ | Site coordinates, map projection |
| `src/oee/worldMap.ts` | 10 | ✓ | ✓ | – | – | Generated SVG path (constants) |
| `src/oee/downloadFile.ts` | 19 | ✓ | ~ | ~ | ✓ | Browser adapter (CSV and HTML); calls `window.setTimeout` directly |
| `src/oee/touchScreen.ts` | 13 | ✓ | ✓ | ✓ | ✓ | Touch detection (injected), touch sizes |
| `src/oee/cardLayout.ts` | 7 | ✓ | ✓ | – | – | Two class constants |
| `src/oee/oeeDeps.ts` | 36 | ✓ | ✓ | ✓ | ✓ (through users) | Dependency context: service, host sync, download, touch, clock |
| `src/oee/oeeState.ts` | 58 | ✓ | ✓ | ✓ | ✓ | Host-synced state, guarded parsing |
| `src/oee/exportForm.ts` | 57 | ✓ | ✓ | ✓ | ✓ (through users) | Export form storage context |
| `src/oee/reportForm.ts` | 28 | ✓ | ✓ | ✓ | ✓ (through users) | Report form storage context |
| `src/oee/OeeStateProvider.tsx` | 19 | ✓ | ✓ | ✓ | ✓ (through users) | State storage |
| `src/oee/ExportStorageProvider.tsx` | 25 | ✓ | ✓ | ✓ | ✓ (through users) | State storage, cancel signal |
| `src/oee/ReportStorageProvider.tsx` | 13 | ✓ | ✓ | ✓ | ✓ (through users) | State storage |
| `src/oee/AppErrorBoundary.tsx` | 44 | ✓ | ✓ | ✓ | ✓ | Message and "Try again" instead of a blank page |
| `src/oee/useSiteUnits.ts` | 34 | ✓ | ✓ | ✓ | ✓ (through users) | Shared queries: sites, units of every site |
| `src/oee/useOeeSelection.ts` | 75 | ✓ | ✓ | ✓ | ✓ | **New.** The selection and its commands, synced to the host |
| `src/oee/useSitesOverviewViewModel.ts` | 42 | ✓ | ✓ | ✓ | ✓ | **New.** Overview tab |
| `src/oee/useUnitTypesViewModel.ts` | 89 | ✓ | ✓ | ✓ | ✓ | **New.** Unit types tab |
| `src/oee/useSiteDetailViewModel.ts` | 54 | ✓ | ✓ | ✓ | ✓ | **New.** Site tab |
| `src/oee/useExportViewModel.ts` | 221 | ✓ | ~ | ✓ | ✓ | Export tab; the run is a promise with its own state, not a mutation hook |
| `src/oee/useWeeklyReportViewModel.ts` | 103 | ✓ | ✓ | ✓ | ✓ | Weekly report tab |
| `src/oee/useRetryFailedReads.ts` | 13 | ✓ | ✓ | ✓ | ✓ (page tests) | Reads again what failed |
| `src/oee/OeePage.tsx` | 88 | ✓ | ✓ | ✓ | ✓ | Page shell and tabs |
| `src/oee/SitesOverview.tsx` | 51 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/SitesMap.tsx` | 98 | ✓ | ~ | ✓ | ✓ (page tests) | Custom map (no Aura equivalent), four inline styles for positions and data colours; neighbouring markers overlap |
| `src/oee/SiteLowestUnits.tsx` | 41 | ✓ | ✓ | ✓ | ✓ | Hover card content |
| `src/oee/SiteOeeValue.tsx` | 43 | ✓ | ✓ | ✓ | ✓ (page tests) | The OEE of a site with its colour code |
| `src/oee/OverviewTable.tsx` | 85 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/UnitTypesView.tsx` | 148 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/UnitTypesChart.tsx` | 76 | ✓ | ✓ | ✓ | ~ | Chart, asserted by its accessible name only |
| `src/oee/UnitTypesTable.tsx` | 112 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/UnitTypeDetail.tsx` | 58 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/SiteDetail.tsx` | 161 | ~ | ✓ | ✓ | ✓ (page tests) | Over 150 lines, render only |
| `src/oee/SiteSelect.tsx` | 50 | ✓ | ✓ | ✓ | ~ | Selection through the Aura Select is not exercised in tests |
| `src/oee/SiteKpiTiles.tsx` | 55 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/UnitTable.tsx` | 86 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/OeeTrendChart.tsx` | 79 | ✓ | ✓ | ✓ | ~ | Chart, asserted by its accessible name only |
| `src/oee/TrendRangeControl.tsx` | 41 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura SegmentedControl |
| `src/oee/ExportView.tsx` | 254 | ~ | ✓ | ✓ | ✓ (page tests) | Over 150 lines, render only; one form |
| `src/oee/WeeklyReportView.tsx` | 189 | ~ | ✓ | ✓ | ✓ (page tests) | Over 150 lines, render only |
| `src/oee/ReportTables.tsx` | 137 | ✓ | ✓ | ✓ | ✓ (page tests) | Three Aura DataGrids |
| `src/oee/OeeValue.tsx` | 32 | ✓ | ✓ | ✓ | ✓ (page tests) | The OEE of a unit with its level |
| `src/oee/OeeStates.tsx` | 40 | ✓ | ✓ | ✓ | ✓ (page tests) | Loading, error with retry, empty |
| `src/oee/SelectableName.tsx` | 24 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |

Removed since round 2: `src/oee/useOeeViewModel.ts` (split into four hooks).

Test files (24, 263 tests): `App.test.tsx`, `oee/OeePage.test.tsx`, `oee/OeePage.a11y.test.tsx`,
`oee/OeePage.recovery.test.tsx`, `oee/oeeViewModels.test.tsx`, `oee/useExportViewModel.test.tsx`,
`oee/exportCancel.test.tsx`, `oee/weeklyReport.test.ts`, `oee/weeklyReportFlow.test.tsx`,
`oee/oeeService.test.ts`, `oee/schema.test.ts`, `oee/oeeErrors.test.ts`, `oee/oeeExport.test.ts`,
`oee/oeeFormat.test.ts`, `oee/shortenName.test.ts`, `oee/oeeKpi.test.ts`, `oee/oeeState.test.ts`,
`oee/unitTypes.test.ts`, `oee/siteLocations.test.ts`, `oee/downloadFile.test.ts`,
`oee/touchScreen.test.ts`, `oee/AppErrorBoundary.test.tsx`, `oee/SiteLowestUnits.test.tsx`,
`shared/utils/semaphore.test.ts`.

Structure note (code-quality step 9), unchanged: the app uses one feature folder `src/oee/` with
PascalCase component files and camelCase modules, not the `components/ hooks/ utils/ contexts/
views/ types/` layout with kebab-case file names that the skill describes.
