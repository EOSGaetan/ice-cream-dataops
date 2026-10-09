# Findings: Ice Cream Factory OEE (round 3)

Every hunt of `flows-review-checks` (pulled from `cognitedata/builder-skills` on 2026-10-09, with
`code-quality`) run from the app root on version 0.0.10.

## Config inspected
- Coverage config file(s): `vitest.config.ts` (`vite.config.ts` has no `test` block).
- Coverage scope: `coverage.include` is `src/**/*.{ts,tsx}` (`vitest.config.ts:15`).
- Production paths excluded from coverage: none. The excludes (`vitest.config.ts:16`) are the test
  files, `src/main.tsx` and `src/vite-env.d.ts`.
- Tests excluded from the test run: none under `src/` (`.claude/**` and `.agents/**` only,
  `vitest.config.ts:10`).

## Searches
| Check | Hits (file:line or none) |
| ----- | ------------------------ |
| ErrorBoundary | `src/oee/AppErrorBoundary.tsx:17`, used in `src/App.tsx:80` |
| TODO / FIXME / HACK / XXX | none |
| `useEffect` | `src/App.tsx:107` (host connection, with a cancel flag as cleanup) |
| `useQuery` / `useMutation` in `.tsx` | none: every query is in a hook (`useSiteUnits.ts`, `useSitesOverviewViewModel.ts`, `useUnitTypesViewModel.ts`, `useSiteDetailViewModel.ts`, `useWeeklyReportViewModel.ts`) |
| Loading / error / empty handling | every data region has the three states; failed reads offer "Try again" (`src/oee/OeeStates.tsx`) |
| coverage/test exclude | no production file excluded (see above) |
| CDF Raw | none |
| instances.list/query/search | `src/oee/oeeService.ts:352` (`instances.list`, server-side filter, limit 1000, cursor) |
| QueuedTaskRunner / 429 | `src/shared/utils/semaphore.ts:9,38`; every CDF call goes through `runner.schedule` (cap 15). 429 is explained to the user (`src/oee/oeeErrors.ts:10`); retries with exponential jitter backoff (bound 5) come from the Cognite SDK |
| any / as unknown as | none |
| `as` casts in production | none |
| vi.mock | none |
| lint / tsc | 0 lint errors, 0 warnings (including `aura/no-overriding-styles`); `tsc --noEmit` clean |
| CogniteClient / DI / ViewModel | `new CogniteClient` only in `src/App.test.tsx:33,40`; service behind `OeeService`, taken from `OeeDepsContext`; single-purpose ViewModel hooks without local state |
| classes | `src/oee/oeeService.ts:93` (`CdfOeeService implements OeeService`), `src/shared/utils/semaphore.ts:9` |
| unused files / console.log | none (`src/vite-env.d.ts` is the type reference); `console.*`: none |
| routes | none (single page, tabs) |
| components > 150 lines | `src/oee/ExportView.tsx` (254), `src/oee/WeeklyReportView.tsx` (189), `src/oee/SiteDetail.tsx` (161): render only, no data fetching |

## Changes since round 2 that the hunts reflect
- The single view-model hook of three tabs is split into `useOeeSelection`,
  `useSitesOverviewViewModel`, `useUnitTypesViewModel` and `useSiteDetailViewModel`.
- Instance properties are parsed with Zod where they enter the app (`src/oee/schema.ts`); the
  hand-written readers are gone.
- The identifiers of the data model are in `src/config/model.ts` only.
- New since round 2: weekly report tab, export cancel, retry on failed reads, touch sizes.

## Checks beyond the hunts
- **Real data, read-only, test project** (`cdf-bootcamp-33-test`): the 1021 assets pass the Zod
  parse; the single read returns the same 628 units as the site-by-site read (13 requests against
  59); the weekly report reads its two weeks in 22 requests.
- **Build**: succeeds; main JavaScript chunk 788 kB, charts 348 kB loaded on demand.

## Must / should / nice
### Must fix
- none

### Should fix
- [ ] `@cognite/aura` is one major behind (0.3.5, latest 1.x); `@tanstack/react-table` and `react` follow it — `package.json` — criterion 1.3
- [ ] File and folder naming differs from code-quality steps 7 and 9 (one flat feature folder, PascalCase and camelCase file names) — `src/oee/` — criterion 1.5
- [ ] Two map markers of neighbouring European sites overlap (free hit area under 24 px); the table under the map gives the same action — `src/oee/SitesMap.tsx:76` — criterion 3.1 (accessibility)

### Nice to fix
- [ ] `window.setTimeout` called directly in the download adapter — `src/oee/downloadFile.ts:18`
- [ ] Three render-only components over 150 lines — `src/oee/ExportView.tsx`, `src/oee/WeeklyReportView.tsx`, `src/oee/SiteDetail.tsx`
- [ ] `instances.list` could become `instances.query` for the asset reads — `src/oee/oeeService.ts:352` — criterion 2.1
- [ ] Main JavaScript chunk of 788 kB — `vite.config.ts`
- [ ] The two charts are asserted by their accessible name only (44% and 57% of their lines covered) — `src/oee/OeeTrendChart.tsx`, `src/oee/UnitTypesChart.tsx` — criterion 1.4
