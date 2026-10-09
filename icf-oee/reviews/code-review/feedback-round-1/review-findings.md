# Findings: Ice Cream Factory OEE (round 1)

## Config inspected
- Coverage config file(s): `vitest.config.ts` (`vite.config.ts` has no `test` block).
- Production paths excluded from coverage: **`src/devPreview.tsx`** (`coverage.exclude`,
  `vitest.config.ts:14`). The other excludes are outside `src/` or allowed (`**/*.d.ts`).
  There is no `coverage.include`, so a file that no test imports is not measured either:
  `src/lib/utils.ts` and `src/main.tsx`.
- Tests excluded from the test run: none under `src/` (`.claude/**` and `.agents/**` only).

## Searches
| Check | Hits (file:line or none) |
| ----- | ------------------------ |
| ErrorBoundary | none |
| TODO / FIXME / HACK | none |
| `useEffect` | `src/App.tsx:95` (host connection, has a cancel flag as cleanup) |
| Loading / error / empty handling | `ExportView.tsx`, `SiteDetail.tsx`, `SiteLowestUnits.tsx`, `SiteSelect.tsx`, `SitesOverview.tsx`, `UnitTypesView.tsx`, `useExportViewModel.ts`, `useOeeViewModel.ts`, `useSiteUnits.ts`: every data region has the three states |
| coverage/test exclude | `vitest.config.ts:14` excludes `src/devPreview.tsx` |
| CDF Raw | none |
| instances.list/query/search | `src/oee/oeeService.ts:274` (`instances.list`, server-side filter, limit 1000, cursor) |
| QueuedTaskRunner / 429 | `src/shared/utils/semaphore.ts:9,38`, `src/oee/oeeService.ts:3,42` (cap 15, every CDF call scheduled). No explicit 429 / `Retry-After` handling in `src/`; retries come from TanStack Query defaults (3, exponential) |
| any / as unknown as | none |
| vi.mock | none |
| lint / tsc | 0 lint errors, 0 warnings; `tsc --noEmit` clean |
| CogniteClient / DI / ViewModel | `new CogniteClient` only in `src/App.test.tsx:33,40`; service behind the `OeeService` interface, taken from `OeeDepsContext`; `useOeeViewModel`, `useExportViewModel` |
| classes | `src/oee/oeeService.ts:60` (`CdfOeeService implements OeeService`), `src/shared/utils/semaphore.ts:9` |
| unused files / console.log | **`src/lib/utils.ts`** is imported nowhere; `console.*`: none |
| routes | none (single page, tabs) |
| components > 150 lines | `src/oee/ExportView.tsx` (234), `src/oee/SiteDetail.tsx` (174): render only, no data fetching |
| naming (lowercase `.tsx`) | `src/devPreview.tsx`, `src/__mocks__/oee.tsx` (and the allowed `main.tsx`, hook tests) |
| commented-out code | none |

## Must / should / nice
### Must fix
- [ ] A production-tree file is excluded from the coverage measurement — `vitest.config.ts:14` (`src/devPreview.tsx`) — criterion 1.4
- [ ] Coverage is measured only on the files that tests import (no `coverage.include`), so the 80% gate is not proven on all of `src/` — `vitest.config.ts:11-15` — criterion 1.4
- [ ] Unused file — `src/lib/utils.ts:1` — criterion 1.5

### Should fix
- [ ] No ErrorBoundary: a render error blanks the app — `src/App.tsx:105` — criterion 1.1
- [ ] No handling of 429 responses beyond the concurrency cap and the default query retries — `src/oee/oeeService.ts:42`, `src/main.tsx:9` — criterion 2.5
- [ ] The overview and the unit types read the units site by site: 10 `instances.list` and about 40 `timeseries/data/latest` requests, then 31 more for the statistics — `src/oee/useSiteUnits.ts:23`, `src/oee/oeeService.ts:95` — criteria 2.3, 2.4
- [ ] Dependencies one major behind: `@cognite/aura` 0.3.5 (latest 1.x), `@tanstack/react-table` 8 (latest 9), `react` / `react-dom` 18 (latest 19); 4 moderate advisories in the Vitest tooling — `package.json` — criterion 1.3
- [ ] File and folder naming differs from code-quality step 7 and step 9 (feature folder, PascalCase and camelCase file names instead of kebab-case and `components/ hooks/ utils/`) — `src/oee/` — criterion 1.5
- [ ] The viewport meta tag forbids zooming (`maximum-scale=1.0, user-scalable=no`) — `index.html:8` — criterion 3.1 (accessibility)
- [ ] Map markers have a 28 px hit area and carry the site level by colour only — `src/oee/SitesMap.tsx:71` — criterion 3.1 (accessibility)

### Nice to fix
- [ ] `window.setTimeout` called directly instead of an injected timer — `src/oee/downloadFile.ts:16`
- [ ] Two render-only components over 150 lines — `src/oee/ExportView.tsx`, `src/oee/SiteDetail.tsx`
- [ ] `instances.list` could become `instances.query` for the asset reads — `src/oee/oeeService.ts:274` — criterion 2.1
- [ ] Bundle of 1.15 MB in one chunk (recharts, table) — `vite.config.ts`
