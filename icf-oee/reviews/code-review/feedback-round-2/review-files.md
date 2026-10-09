# File inventory: Ice Cream Factory OEE (round 2)

Scope: every `.ts` / `.tsx` under `src/` (no `node_modules`, `dist`, `.cognite-bundles`), plus the
test and build configuration and the development preview. Only the files that changed since
round 1 carry a note about the change; the others are as in round 1.
Legend: ✓ meets the bar, ~ minor gap, ✗ gap, – not applicable.

| File | Lines | Structure | Quality | Patterns | Tests | Notes |
| ---- | ----- | --------- | ------- | -------- | ----- | ----- |
| `vitest.config.ts` | 19 | ✓ | ✓ | – | – | **Changed.** `coverage.include` covers all of `src/`; no production file excluded |
| `vite.config.ts` | 28 | ✓ | ✓ | – | – | Unchanged |
| `index.html` | – | ✓ | ✓ | – | – | **Changed.** The viewport no longer forbids zooming |
| `dev/devPreview.tsx` | 133 | ✓ | ✓ | – | – | **Moved** out of `src/`. Development-only page with fake data, not bundled |
| `src/main.tsx` | 24 | ✓ | ✓ | ✓ | – | Bootstrap only (allowed outside coverage) |
| `src/App.tsx` | 131 | ✓ | ✓ | ✓ | ✓ | **Changed.** The page is wrapped in `AppErrorBoundary` |
| `src/styles.css` | – | ✓ | ~ | – | – | **Changed.** One token override for the light theme: secondary text grey from mountain-500 to mountain-600 (contrast 5.8:1), documented in the file |
| `src/vite-env.d.ts` | 1 | ✓ | ✓ | – | – | Type reference only |
| `src/__mocks__/oee.tsx` | 143 | ✓ | ✓ | ✓ | – | **Changed.** Doubles for the three new service methods |
| `src/shared/utils/semaphore.ts` | 38 | ✓ | ✓ | ✓ | ✓ | Unchanged |
| `src/oee/types.ts` | 121 | ✓ | ✓ | ✓ | ✓ (through users) | **Changed.** `SiteUnit`, `UnitOeeStats`, `UnitComponentMeans` |
| `src/oee/oeeService.ts` | 450 | ~ | ✓ | ✓ | ✓ | **Changed.** `listAllUnits` (one read for every site), statistics split in `getUnitOeeStats` and `getUnitComponentMeans`. One class with seven read methods: long, but one responsibility (reads of the OEE data) |
| `src/oee/oeeExport.ts` | 198 | ✓ | ✓ | ✓ | ✓ | Unchanged |
| `src/oee/oeeFormat.ts` | 48 | ✓ | ✓ | ✓ | ✓ | **Changed.** `shortenName` |
| `src/oee/oeeKpi.ts` | 55 | ✓ | ✓ | ✓ | ✓ | Unchanged |
| `src/oee/unitTypes.ts` | 120 | ✓ | ✓ | ✓ | ✓ | Unchanged |
| `src/oee/siteLocations.ts` | 58 | ✓ | ✓ | ✓ | ✓ | Unchanged |
| `src/oee/worldMap.ts` | 10 | ✓ | ✓ | – | – | Generated SVG path (constants) |
| `src/oee/downloadFile.ts` | 17 | ✓ | ~ | ~ | ✓ | Browser adapter; calls `window.setTimeout` directly |
| `src/oee/oeeDeps.ts` | 22 | ✓ | ✓ | ✓ | ✓ (through users) | Unchanged |
| `src/oee/oeeState.ts` | 58 | ✓ | ✓ | ✓ | ✓ | Unchanged |
| `src/oee/exportForm.ts` | 53 | ✓ | ✓ | ✓ | ✓ (through users) | Unchanged |
| `src/oee/OeeStateProvider.tsx` | 19 | ✓ | ✓ | ✓ | ✓ (through users) | State storage |
| `src/oee/ExportStorageProvider.tsx` | 14 | ✓ | ✓ | ✓ | ✓ (through users) | State storage |
| `src/oee/AppErrorBoundary.tsx` | 44 | ✓ | ✓ | ✓ | ✓ | **New.** Message and "Try again" instead of a blank page |
| `src/oee/useSiteUnits.ts` | 34 | ✓ | ✓ | ✓ | ✓ (through users) | **Rewritten.** One shared query for the units of every site |
| `src/oee/useOeeViewModel.ts` | 241 | ✓ | ~ | ✓ | ✓ | **Changed.** Ranking first, components afterwards. Still long: three tabs in one hook |
| `src/oee/useExportViewModel.ts` | 206 | ✓ | ✓ | ✓ | ✓ | **Changed.** Uses the shared units query |
| `src/oee/OeePage.tsx` | 79 | ✓ | ✓ | ✓ | ✓ | **Changed.** Phone-size header, 44 px tabs on touch screens |
| `src/oee/SitesOverview.tsx` | 51 | ✓ | ✓ | ✓ | ✓ (page tests) | **Changed.** One loading and one error message for the units |
| `src/oee/SitesMap.tsx` | 98 | ✓ | ~ | ✓ | ✓ (page tests) | **Changed.** 44 px markers on touch screens. Neighbouring European markers still overlap |
| `src/oee/SiteLowestUnits.tsx` | 40 | ✓ | ✓ | ✓ | ✓ | **Test added** (`SiteLowestUnits.test.tsx`) |
| `src/oee/OverviewTable.tsx` | 79 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/UnitTypesView.tsx` | 163 | ~ | ✓ | ✓ | ✓ (page tests) | **Changed.** Chart loaded on demand. Over 150 lines, render only |
| `src/oee/UnitTypesChart.tsx` | 76 | ✓ | ✓ | ✓ | ~ | **Changed.** Narrower, shortened names on a phone. Asserted by its accessible name only |
| `src/oee/UnitTypesTable.tsx` | 108 | ✓ | ✓ | ✓ | ✓ (page tests) | **Changed.** Loading state in the quality, performance and availability cells |
| `src/oee/UnitTypeDetail.tsx` | 54 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/SiteDetail.tsx` | 179 | ~ | ✓ | ✓ | ✓ (page tests) | **Changed.** Chart loaded on demand. Over 150 lines, render only |
| `src/oee/SiteSelect.tsx` | 49 | ✓ | ✓ | ✓ | ~ | Selection through the Aura Select is not exercised in tests |
| `src/oee/SiteKpiTiles.tsx` | 54 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |
| `src/oee/UnitTable.tsx` | 82 | ✓ | ✓ | ✓ | ✓ (page tests) | Aura DataGrid |
| `src/oee/OeeTrendChart.tsx` | 79 | ✓ | ✓ | ✓ | ~ | Chart, asserted by its accessible name only |
| `src/oee/TrendRangeControl.tsx` | 41 | ✓ | ✓ | ✓ | ✓ (page tests) | **Changed.** 44 px shortcuts on touch screens |
| `src/oee/ExportView.tsx` | 234 | ~ | ✓ | ✓ | ✓ (page tests) | Over 150 lines, render only; one form |
| `src/oee/OeeValue.tsx` | 32 | ✓ | ✓ | ✓ | ✓ (page tests) | **Changed.** The level is also given in text for assistive technology |
| `src/oee/OeeStates.tsx` | 30 | ✓ | ✓ | ✓ | ✓ (page tests) | Loading, error, empty |
| `src/oee/SelectableName.tsx` | 24 | ✓ | ✓ | ✓ | ✓ (page tests) | Render only |

Removed since round 1: `src/lib/utils.ts` (unused), `src/devPreview.tsx` (moved to `dev/`).

Test files (17, 187 tests): the 13 of round 1 plus `oee/AppErrorBoundary.test.tsx`,
`oee/OeePage.a11y.test.tsx`, `oee/SiteLowestUnits.test.tsx` and `oee/shortenName.test.ts`.

Structure note (code-quality step 9), unchanged: the app uses one feature folder `src/oee/` with
PascalCase component files and camelCase modules, not the `components/ hooks/ utils/ contexts/
views/ types/` layout with kebab-case file names that the skill describes.
