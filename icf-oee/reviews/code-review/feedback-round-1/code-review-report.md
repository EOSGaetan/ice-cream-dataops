# Ice Cream Factory OEE — Flows code review

This document is the platform review for Ice Cream Factory OEE, conducted as part of the Cognite Flows app certification process.

## Path to approval

This review found **3 must-fix item(s)** that block approval. Once the must-fix items are addressed, re-run `flows-code-review`.

### Reviewed commit
`90acb439a7f0bcc0dfa1c1c4946fa4204cb31760` plus the uncommitted working tree of version 0.0.5
(22 changed files: the Export tab).

`App-Brief.md` is missing at the repository root: `flows-app-brief` should be run before submission.

## Checks performed

- Latest `flows-review-checks` and `code-quality` pulled from `cognitedata/builder-skills` with
  `npx @cognite/cli@latest apps skills pull` before scoring; the fix steps of `code-quality` were
  not applied.
- Every hunt of `flows-review-checks` step 1 was run from the app root; results are in
  `review-findings.md`, the file inventory in `review-files.md`, the package audit in
  `review-packages.md`.
- `npm run lint`: 0 errors, 0 warnings. `npx tsc --noEmit`: clean.
- `npx vitest run --coverage` (Vitest 4.1.10, v8): 13 test files, 160 tests passed, 0 failed,
  0 skipped. Printed coverage: statements 94.96%, branches 82.98%, functions 94.56%, lines 96.48%.

## Coverage scope

The printed percentage does **not** count as the 80% gate:

- `vitest.config.ts:14` excludes `src/devPreview.tsx`, a file under `src/` that is neither a test,
  `vite-env.d.ts`, `main.tsx` nor generated code.
- There is no `coverage.include`: only the files imported by a test are measured, so
  `src/lib/utils.ts` is left out silently.

## Scores

| Area | Criterion | Score | Notes |
| ---- | --------- | ----- | ----- |
| User & customer | 1.1 Known bugs | 3/5 | No ErrorBoundary (`src/App.tsx`); every data region has loading, error and empty states (`SiteDetail.tsx`, `SitesOverview.tsx`, `UnitTypesView.tsx`, `ExportView.tsx`); the only `useEffect` has a cleanup. |
| User & customer | 1.3 Packages | 3/5 | No high or critical advisory. 4 moderate advisories in the Vitest tooling (patched in 4.1.11), 4 low transitive ones through Aura. `@cognite/aura` one major behind. |
| User & customer | 1.4 Tests & coverage | 2/5 | 160 tests run and pass, but `src/devPreview.tsx` is excluded and the measured set is not all of `src/` (`vitest.config.ts:11-15`). |
| User & customer | 1.5 Dead code | 2/5 | `src/lib/utils.ts` is unused. No `any`, no lint error, no commented-out code, no `console.*`. File naming and folders differ from the code-quality layout. |
| User & customer | 1.6 Patterns & testability | 4/5 | Service behind `OeeService` and taken from `OeeDepsContext`; narrow SDK client; ViewModels without local state; no `vi.mock`. `downloadFile.ts` calls the browser timer directly. |
| Cognite services | 2.1 DMS query patterns | 4/5 | One read path, `instances.list` with a server-side filter (`oeeService.ts:274`); it could be `instances.query`. |
| Cognite services | 2.2 Server-side filter | 4/5 | Sites and site assets are filtered in the request; the units are found by asking the latest datapoint of four series for every asset with `ignoreUnknownIds`, a small over-ask. |
| Cognite services | 2.3 Limits & pages | 3/5 | Explicit limits and cursors everywhere, but the overview and the unit types read every site one by one (10 list requests and about 40 latest-datapoint requests). |
| Cognite services | 2.4 Call rate | 3/5 | About 80 requests to open the unit types tab; cached 5 minutes and capped at 15 concurrent requests. |
| Cognite services | 2.5 429 backoff | 4/5 | `cdfTaskRunner` caps every CDF call; retries with exponential jitter backoff and a bound of 5 come from the Cognite SDK, plus the TanStack Query defaults. Nothing app-specific for `Retry-After`. |
| Cognite services | 2.6 CDF Raw | N/A | No Raw usage. |
| Brand | 3.1 Aura | 4/5 | Aura components and tokens throughout (Card, Tabs, Select, DataGrid, Badge, Alert, EmptyState, HoverCard, SegmentedControl, Checkbox, Input, Button, chart). One custom widget, the map. Accessibility gaps listed under Should Fix. |

## Must Fix

1. **A file under `src/` is excluded from coverage** — `vitest.config.ts:14` (`src/devPreview.tsx`) — criterion 1.4.
   _Impact:_ the coverage figure shown to reviewers and users overstates what is tested, so a regression in unmeasured code can ship unnoticed.
2. **Coverage is not measured on all of `src/`** — `vitest.config.ts:11-15` (no `coverage.include`) — criterion 1.4.
   _Impact:_ a new file without any test would not lower the figure, so the 80% gate cannot protect users from untested code.
3. **Unused file** — `src/lib/utils.ts:1` — criterion 1.5.
   _Impact:_ dead code misleads the next maintainer and is shipped to reviewers as if it were part of the app.

## Should Fix

1. No ErrorBoundary — `src/App.tsx:105` — criterion 1.1.
2. The overview and the unit types read the units site by site (N+1) — `src/oee/useSiteUnits.ts:23`, `src/oee/oeeService.ts:95` — criteria 2.3 and 2.4.
3. Vitest tooling has 4 moderate advisories, patched in 4.1.11 — `package.json` — criterion 1.3.
4. `@cognite/aura` is one major behind (0.3.5, latest 1.x) — `package.json` — criterion 1.3.
5. The viewport meta tag forbids zooming — `index.html:8` — criterion 3.1 (accessibility).
6. Map markers: 28 px hit area, site level carried by colour only — `src/oee/SitesMap.tsx:71` — criterion 3.1 (accessibility).
7. File and folder naming differs from code-quality steps 7 and 9 — `src/oee/` — criterion 1.5.

## Nice Fix

1. `window.setTimeout` called directly — `src/oee/downloadFile.ts:16`.
2. Two render-only components over 150 lines — `src/oee/ExportView.tsx`, `src/oee/SiteDetail.tsx`.
3. `instances.list` could become `instances.query` — `src/oee/oeeService.ts:274`.
4. Single 1.15 MB JavaScript chunk — `vite.config.ts`.

## Summary

- Must Fix open: 3
- Should Fix open: 7
- Nice Fix open: 4
