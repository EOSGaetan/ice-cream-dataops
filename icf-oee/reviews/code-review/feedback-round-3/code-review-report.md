# Ice Cream Factory OEE — Flows code review (round 3)

This document is the platform review for Ice Cream Factory OEE, conducted as part of the Cognite Flows app certification process. It is a self-review run by the builder's coding agent, not a review by Cognite.

## Path to approval

This review found **0 must-fix item**. Three should-fix items and five nice-to-fix items stay open
(listed below).

### Reviewed commit
`6ccbff60e3ecf1783064450010d3e63aee750b1c` plus the working tree of version 0.0.10, which is
committed together with this report.

## Checks performed

- `flows-review-checks` and `code-quality` pulled from `cognitedata/builder-skills` with
  `npx @cognite/cli@latest apps skills pull` before scoring; the fix steps of `code-quality` were
  not applied during the review.
- Every hunt of `flows-review-checks` step 1 was run from the app root; results are in
  `review-findings.md`, the file inventory in `review-files.md`, the package audit in
  `review-packages.md`.
- `npm run lint`: 0 errors, 0 warnings. `npx tsc --noEmit`: clean. `npm run build`: succeeds.
- `npx vitest run --coverage` (Vitest 4.1.11, v8): 24 test files, 263 tests passed, 0 failed,
  0 skipped. Coverage on all of `src/`: statements 96.28%, branches 86.43%, functions 95.92%,
  lines 97.19%.
- Read-only run against the test project (`cdf-bootcamp-33-test`): the real assets pass the Zod
  parse and give the same 628 units as before.

Not checked in this round: a real phone or tablet, a screen reader.

## Coverage scope

The printed percentage counts as the 80% gate: `coverage.include` is `src/**/*.{ts,tsx}`
(`vitest.config.ts:15`) and the only excludes are the test files, `src/main.tsx` and
`src/vite-env.d.ts` (`vitest.config.ts:16`).

## Scores

| Area | Criterion | Round 2 | Round 3 | Notes |
| ---- | --------- | ------- | ------- | ----- |
| User & customer | 1.1 Known bugs | 4/5 | 4/5 | Error boundary around the page (`src/App.tsx:80`); loading, error and empty states on every data region; failed reads can be retried; a running export can be cancelled. The boundary sits inside the state providers, so a failure in a provider is not caught. |
| User & customer | 1.3 Packages | 3/5 | 3/5 | No critical, high or moderate advisory (4 low, transitive through Aura). `@cognite/aura` one major behind, with `react` and `@tanstack/react-table` tied to it. |
| User & customer | 1.4 Tests & coverage | 4/5 | 4/5 | 263 tests, 97.19% of the lines of all of `src/`. The two charts are asserted by their accessible name only. |
| User & customer | 1.5 Dead code | 4/5 | 4/5 | No unused file, no `any`, no `as` cast, no lint error, no `console.*`. File naming and folders differ from the code-quality layout. |
| User & customer | 1.6 Patterns & testability | 4/5 | 4/5 | Dependencies from `OeeDepsContext`; service behind an interface; single-purpose ViewModel hooks without local state; no `vi.mock`. The download adapter calls the browser timer directly. |
| Cognite services | 2.1 DMS query patterns | 4/5 | 4/5 | One read path, `instances.list` with a server-side filter (`oeeService.ts:352`); it could be `instances.query`. |
| Cognite services | 2.2 Server-side filter | 4/5 | 4/5 | Filters in the request. The units are found by asking the latest OEE datapoint of every asset that is not a site, with `ignoreUnknownIds`: a small over-ask. |
| Cognite services | 2.3 Limits & pages | 4/5 | 4/5 | Explicit limits and cursors; one paginated read of the assets for every site. |
| Cognite services | 2.4 Call rate | 4/5 | 4/5 | Overview 14 requests, unit types 26 before the ranking, weekly report 22; cached 5 minutes, capped at 15 concurrent requests. |
| Cognite services | 2.5 429 backoff | 4/5 | 4/5 | `cdfTaskRunner` caps every CDF call; retries with exponential jitter backoff and a bound of 5 come from the Cognite SDK; a 429 that still fails is explained to the user. Nothing app-specific for `Retry-After`. |
| Cognite services | 2.6 CDF Raw | N/A | N/A | No Raw usage. |
| Brand | 3.1 Aura | 4/5 | 4/5 | Aura components and tokens throughout; `aura/no-overriding-styles` reports nothing. One custom widget, the map, with four inline styles for positions and data colours and one accessibility limit. |

## Must Fix

None open.

## Should Fix

1. `@cognite/aura` is one major behind (0.3.5, latest 1.x) — `package.json` — criterion 1.3.
   A major upgrade of the component library: to do as its own change, checked visually in Fusion.
2. File and folder naming differs from code-quality steps 7 and 9 — `src/oee/` — criterion 1.5.
3. Two map markers of neighbouring European sites overlap (free hit area under 24 px). The table
   under the map gives the same action for every site — `src/oee/SitesMap.tsx:76` — criterion 3.1
   (accessibility).

## Nice Fix

1. `window.setTimeout` called directly — `src/oee/downloadFile.ts:18`.
2. Three render-only components over 150 lines — `src/oee/ExportView.tsx`, `src/oee/WeeklyReportView.tsx`, `src/oee/SiteDetail.tsx`.
3. `instances.list` could become `instances.query` — `src/oee/oeeService.ts:352`.
4. Main JavaScript chunk of 788 kB — `vite.config.ts`.
5. The two charts are asserted by their accessible name only — `src/oee/OeeTrendChart.tsx`, `src/oee/UnitTypesChart.tsx`.

## Summary

- Must Fix open: 0
- Should Fix open: 3
- Nice Fix open: 5
