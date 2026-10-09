## Package audit: Ice Cream Factory OEE (round 2)

Source: `npm outdated` and `npm audit`, run on 2026-10-09 after the fixes. A lockfile is present
(`package-lock.json`).

### Changes since round 1

- `vitest`, `@vitest/ui`, `@vitest/coverage-v8`: 4.1.10 to 4.1.11 (removes the 4 moderate advisories).
- `clsx`, `tailwind-merge`: removed, they were only used by the deleted `src/lib/utils.ts`.
- `axe-core` 4.14 added as a development dependency (accessibility test).

### Dependencies

| Package | Used version | Latest | Deprecated | CVEs | Health |
| ------- | ------------ | ------ | ---------- | ---- | ------ |
| `@cognite/app-sdk` | 0.9.0 | 0.10.0 | no | none | Pass |
| `@cognite/aura` | 0.3.5 | 1.46250.0 | no | 4 low, transitive (`mermaid`, `katex`, `@streamdown/mermaid`) | Warn (1 major behind) |
| `@cognite/sdk` | 10.x | up to date | no | none | Pass |
| `@tabler/icons-react` | 3.48.0 | 3.49.0 | no | none | Pass |
| `@tanstack/react-query` | 5.x | up to date | no | none | Pass |
| `@tanstack/react-table` | 8.21.3 | 9.2.6 | no | none | Warn (1 major behind; Aura 0.3.5 requires `^8.7.4`) |
| `@tanstack/react-virtual` | 3.x | up to date | no | none | Pass |
| `react`, `react-dom` | 18.3.1 | 19.3.0 | no | none | Warn (1 major behind; the Flows template and Aura 0.3.5 require `^18.3.1`) |
| `recharts` | 3.x | up to date | no | none | Pass |

Development dependencies one major behind (not counted against the production bar): `eslint`,
`@eslint/js`, `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/ui`, `@vitest/coverage-v8`,
`@testing-library/jest-dom`, `@types/react`, `@types/react-dom`; `typescript` two majors behind
(5.9.3, latest 7.0.2). All are the versions pinned by the Flows template.

### Security audit

| Severity | Count |
| -------- | ----- |
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 4 |

#### Vulnerabilities

| Package | Severity | Title | Patched in | Advisory |
| ------- | -------- | ----- | ---------- | -------- |
| `katex` (transitive of `@cognite/aura`) | Low | Existing prototype pollution can bypass trust restrictions | Not fixable without changing the Aura version | Reported by `npm audit` |
| `mermaid`, `@streamdown/mermaid`, `@cognite/aura` | Low | Inherited from `katex` | Same | Same |

The low advisories come from Aura components the app does not import (it imports each Aura
component from its own subpath, not from the barrel).

### Still open

`@cognite/aura` 0.3.5 to 1.x is a major upgrade of the whole component library. It was not done in
this round: it has to be its own change, checked visually inside Fusion on every tab.
