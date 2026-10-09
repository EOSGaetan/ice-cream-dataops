# Ice Cream Factory OEE — Flows code review (round 2)

This document is the platform review for Ice Cream Factory OEE, conducted as part of the Cognite Flows app certification process. It is a self-review run by the builder's coding agent, not a review by Cognite.

## Path to approval

This review found **0 must-fix item**. The three must-fix items of round 1 are closed. Three
should-fix items and four nice-to-fix items stay open (listed below).

Before submission: `App-Brief.md` is still missing at the repository root (`flows-app-brief`), and
the design review (`flows-design-review`) has not been scored: it needs the builder to walk the
tasks of the app.

### Reviewed commit
`90acb439a7f0bcc0dfa1c1c4946fa4204cb31760` plus the uncommitted working tree of version 0.0.5 (the
Export tab and the fixes of round 1). Nothing of this round is committed or deployed yet.

## Checks performed

- Every hunt of round 1 was run again on the working tree; results are in `review-findings.md`,
  the file inventory in `review-files.md`, the package audit in `review-packages.md`.
- `npm run lint`: 0 errors, 0 warnings. `npx tsc --noEmit`: clean. `npm run build`: succeeds.
- `npx vitest run --coverage` (Vitest 4.1.11, v8): 17 test files, 187 tests passed, 0 failed,
  0 skipped. Coverage on all of `src/`: statements 95.36%, branches 85.29%, functions 94.95%,
  lines 96.68%.
- Read-only run of the new unit read against the test project (`cdf-bootcamp-33-test`): same
  628 units as the former site-by-site read, 13 requests instead of 59.
- axe-core 4.14 in a browser on the four tabs of the development preview, and the same rules in
  the test suite (`src/oee/OeePage.a11y.test.tsx`).
- Layout measured at 375 px wide on the four tabs of the development preview.

Not checked in this round: the app inside Fusion (version 0.0.5 is not deployed), a real phone,
a screen reader, and the real CSV download inside the Fusion frame.

## Coverage scope

The printed percentage now counts as the 80% gate: `coverage.include` is `src/**/*.{ts,tsx}`
(`vitest.config.ts:15`) and the only excludes are the test files, `src/main.tsx` and
`src/vite-env.d.ts` (`vitest.config.ts:16`).

## Scores

| Area | Criterion | Round 1 | Round 2 | Notes |
| ---- | --------- | ------- | ------- | ----- |
| User & customer | 1.1 Known bugs | 3/5 | 4/5 | `AppErrorBoundary` around the page (`src/App.tsx:75`); every data region has loading, error and empty states. |
| User & customer | 1.3 Packages | 3/5 | 3/5 | No critical, high or moderate advisory left (4 low, transitive through Aura). `@cognite/aura` still one major behind. |
| User & customer | 1.4 Tests & coverage | 2/5 | 4/5 | 187 tests, 96.68% of the lines of all of `src/`. The two charts are asserted by their accessible name only. |
| User & customer | 1.5 Dead code | 2/5 | 4/5 | No unused file, no `any`, no lint error, no commented-out code, no `console.*`. File naming and folders still differ from the code-quality layout. |
| User & customer | 1.6 Patterns & testability | 4/5 | 4/5 | Unchanged. `downloadFile.ts` still calls the browser timer directly. |
| Cognite services | 2.1 DMS query patterns | 4/5 | 4/5 | Unchanged: `instances.list` with a server-side filter (`oeeService.ts:334`). |
| Cognite services | 2.2 Server-side filter | 4/5 | 4/5 | The single read asks one latest datapoint per asset (OEE only) instead of four. |
| Cognite services | 2.3 Limits & pages | 3/5 | 4/5 | One paginated read of the assets for every site, explicit limits and cursors. |
| Cognite services | 2.4 Call rate | 3/5 | 4/5 | Unit types tab: 26 requests before the ranking shows, 45 in all (about 90 before). Overview: 14 (59 before). Cached 5 minutes, capped at 15 concurrent requests. |
| Cognite services | 2.5 429 backoff | 4/5 | 4/5 | Unchanged. |
| Cognite services | 2.6 CDF Raw | N/A | N/A | No Raw usage. |
| Brand | 3.1 Aura | 4/5 | 4/5 | Aura components and tokens throughout. Accessibility: zoom allowed, text contrast fixed with one documented token override, 44 px touch targets, level given in text. One custom widget, the map, with one accessibility limit left. |

## Must Fix

None open.

1. ~~A file under `src/` is excluded from coverage~~ — closed (`dev/devPreview.tsx`, `vitest.config.ts:16`).
2. ~~Coverage is not measured on all of `src/`~~ — closed (`vitest.config.ts:15`).
3. ~~Unused file `src/lib/utils.ts`~~ — closed (deleted).

## Should Fix

Open:

1. `@cognite/aura` is one major behind (0.3.5, latest 1.x) — `package.json` — criterion 1.3.
   A major upgrade of the component library: to do as its own change, checked visually in Fusion.
2. File and folder naming differs from code-quality steps 7 and 9 — `src/oee/` — criterion 1.5.
3. Two map markers of neighbouring European sites overlap (free hit area under 24 px). The table
   under the map gives the same action for every site, which is the equivalent control that WCAG
   2.5.8 accepts — `src/oee/SitesMap.tsx:76` — criterion 3.1 (accessibility).

Closed in this round: no ErrorBoundary; units read site by site; Vitest advisories; viewport
forbids zooming; map marker hit area and colour-only level; secondary text contrast (found in
this round).

## Nice Fix

1. `window.setTimeout` called directly — `src/oee/downloadFile.ts:16`.
2. Three render-only components over 150 lines — `src/oee/ExportView.tsx`, `src/oee/SiteDetail.tsx`, `src/oee/UnitTypesView.tsx`.
3. `instances.list` could become `instances.query` — `src/oee/oeeService.ts:334`.
4. Main JavaScript chunk of 756 kB (1.15 MB in round 1; the charts, 348 kB, are now loaded on demand) — `vite.config.ts`.

## Summary

- Must Fix open: 0
- Should Fix open: 3
- Nice Fix open: 4
