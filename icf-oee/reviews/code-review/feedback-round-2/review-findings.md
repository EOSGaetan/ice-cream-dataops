# Findings: Ice Cream Factory OEE (round 2)

Re-run of every hunt of round 1 on the working tree after the fixes (2026-10-09).

## Config inspected
- Coverage config file(s): `vitest.config.ts` (`vite.config.ts` has no `test` block).
- Coverage scope: `coverage.include` is `src/**/*.{ts,tsx}` (`vitest.config.ts:15`), so every source
  file counts, including the ones no test imports.
- Paths excluded from coverage (`vitest.config.ts:16`): the test files, `src/main.tsx` (bootstrap) and
  `src/vite-env.d.ts` (type reference). No production file is excluded.
- Tests excluded from the test run: none under `src/` (`.claude/**` and `.agents/**` only).
- The development preview with fake data moved out of the production tree: `dev/devPreview.tsx`,
  loaded only by `dev-preview.html`, which the build does not bundle (only `index.html` is).

## Searches
| Check | Hits (file:line or none) |
| ----- | ------------------------ |
| ErrorBoundary | `src/oee/AppErrorBoundary.tsx:17`, used in `src/App.tsx:75`, tested in `src/oee/AppErrorBoundary.test.tsx` |
| TODO / FIXME / HACK | none |
| `useEffect` | `src/App.tsx:98` (host connection, has a cancel flag as cleanup) |
| Loading / error / empty handling | every data region has the three states; the unit types table also shows a per-cell loading state while mean quality, performance and availability arrive |
| coverage/test exclude | no production file excluded (see above) |
| CDF Raw | none |
| instances.list/query/search | `src/oee/oeeService.ts:334` (`instances.list`, server-side filter, limit 1000, cursor) |
| QueuedTaskRunner / 429 | `src/shared/utils/semaphore.ts`, every CDF call goes through `runner.schedule` (`oeeService.ts:161,254,299,333,364`), cap 15. Retries with exponential jitter backoff (bound 5) come from the Cognite SDK |
| any / as unknown as | none |
| vi.mock | none |
| lint / tsc | 0 lint errors, 0 warnings; `tsc --noEmit` clean |
| CogniteClient / DI / ViewModel | `new CogniteClient` only in `src/App.test.tsx`; service behind `OeeService`, taken from `OeeDepsContext`; `useOeeViewModel`, `useExportViewModel` hold no local state |
| `useState` / `useReducer` | `src/App.tsx:96` (host connection), `OeeStateProvider.tsx:15`, `ExportStorageProvider.tsx:9-10` (storage providers); none in a ViewModel |
| unused files / console.log | none (`OeeTrendChart.tsx` and `UnitTypesChart.tsx` are imported with `lazy(() => import(...))`); `console.*`: none |
| routes | none (single page, tabs) |
| components > 150 lines | `src/oee/ExportView.tsx` (234), `src/oee/SiteDetail.tsx` (179), `src/oee/UnitTypesView.tsx` (163): render only, no data fetching |
| browser globals | `src/oee/downloadFile.ts:9-16` (the injected download adapter), `src/main.tsx:18` |
| commented-out code | none |

## Checks beyond the hunts (new in this round)
- **Real data, read-only, test project** (`cdf-bootcamp-33-test`): the single read `listAllUnits`
  returns the same 628 units of 10 sites as the former site-by-site read (0 difference, same latest
  OEE and timestamp) with 13 requests instead of 59.
- **Request count to open the unit types tab**: 26 before the ranking is shown (1 sites, 13 units,
  12 OEE statistics), then 19 for the mean quality, performance and availability. Round 1: about 90,
  all before anything was shown. Overview tab: 14 requests instead of 59.
- **Accessibility, axe-core 4.14 in a browser** on the four tabs of the development preview (WCAG
  2.0 / 2.1 / 2.2 A and AA plus best practices): 0 violation on Unit types, Site and Export. One
  remaining on Overview: `target-size` on 2 map markers of European sites that overlap (see Should
  Fix). The 10 to 20 `color-contrast` violations per tab found at the start of the round are fixed.
- **Accessibility, automated in the test suite**: `src/oee/OeePage.a11y.test.tsx` runs the same
  rules on the four tabs (contrast and target size excepted: the test DOM computes no layout).
- **Phone width (375 px)**: no horizontal page scroll on any tab; tables scroll inside their own
  frame; tabs, time-frame shortcuts and map markers are 44 px high on touch screens.

## Must / should / nice
### Must fix
- [x] A production-tree file is excluded from the coverage measurement — fixed: `dev/devPreview.tsx`, no exclude of production code (`vitest.config.ts:16`)
- [x] Coverage is not measured on all of `src/` — fixed: `coverage.include` (`vitest.config.ts:15`)
- [x] Unused file `src/lib/utils.ts` — fixed: deleted, with its two dependencies `clsx` and `tailwind-merge`

### Should fix
- [x] No ErrorBoundary — fixed: `src/oee/AppErrorBoundary.tsx`, `src/App.tsx:75`
- [x] Units read site by site (N+1) — fixed: `OeeService.listAllUnits` (`src/oee/oeeService.ts:124`), `src/oee/useSiteUnits.ts:18`
- [x] 4 moderate advisories in the Vitest tooling — fixed: Vitest 4.1.11
- [x] The viewport meta tag forbids zooming — fixed: `index.html:7`
- [x] Map markers: small hit area, level carried by colour only — fixed: 44 px on touch screens (`src/oee/SitesMap.tsx:76`), level in text for assistive technology next to every OEE value (`src/oee/OeeValue.tsx`), site OEE value in the accessible name of each marker
- [x] Secondary text contrast 3.7:1 (new finding of this round) — fixed: `src/styles.css:10`
- [ ] `@cognite/aura` is one major behind (0.3.5, latest 1.x) — `package.json` — criterion 1.3
- [ ] File and folder naming differs from code-quality steps 7 and 9 — `src/oee/` — criterion 1.5
- [ ] Two map markers of neighbouring European sites overlap, so their free hit area is under 24 px; the table under the map offers the same action for every site — `src/oee/SitesMap.tsx:76` — criterion 3.1 (accessibility)

### Nice to fix
- [ ] `window.setTimeout` called directly instead of an injected timer — `src/oee/downloadFile.ts:16`
- [ ] Three render-only components over 150 lines — `src/oee/ExportView.tsx`, `src/oee/SiteDetail.tsx`, `src/oee/UnitTypesView.tsx`
- [ ] `instances.list` could become `instances.query` for the asset reads — `src/oee/oeeService.ts:334` — criterion 2.1
- [ ] Main JavaScript chunk of 756 kB (was 1.15 MB; the charts are now loaded on demand, 348 kB) — `vite.config.ts`
