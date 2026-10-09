## Package audit: Ice Cream Factory OEE (round 1)

Source: `npm outdated --json` and `npm audit --json`, run on 2026-10-09. A lockfile is present
(`package-lock.json`).

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
| `clsx` | 2.x | up to date | no | none | Pass |
| `react`, `react-dom` | 18.3.1 | 19.3.0 | no | none | Warn (1 major behind; the Flows template and Aura 0.3.5 require `^18.3.1`) |
| `recharts` | 3.x | up to date | no | none | Pass |
| `tailwind-merge` | 3.x | up to date | no | none | Pass |

Development dependencies one major behind (not counted against the production bar): `eslint`,
`@eslint/js`, `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/ui`, `@vitest/coverage-v8`,
`@testing-library/jest-dom`, `@types/react`, `@types/react-dom`; `typescript` two majors behind
(5.9.3, latest 7.0.2). All are the versions pinned by the Flows template.

### Security audit

| Severity | Count |
| -------- | ----- |
| Critical | 0 |
| High | 0 |
| Moderate | 4 |
| Low | 4 |

#### Vulnerabilities

| Package | Severity | Title | Patched in | Advisory |
| ------- | -------- | ----- | ---------- | -------- |
| `vitest`, `@vitest/mocker`, `@vitest/ui`, `@vitest/coverage-v8` (dev) | Moderate | Path traversal / arbitrary file read via `@vitest/mocker` redirect mock | 4.1.11 | Reported by `npm audit`; development tooling only, not in the bundle |
| `katex` (transitive of `@cognite/aura`) | Low | Existing prototype pollution can bypass trust restrictions | Not fixable without changing the Aura version | Reported by `npm audit` |
| `mermaid`, `@streamdown/mermaid`, `@cognite/aura` | Low | Inherited from `katex` | Same | Same |

The low advisories come from Aura components the app does not import (it imports each Aura
component from its own subpath, not from the barrel).

Overall health: **Warn** — no high or critical advisory, no deprecated production dependency,
three production dependencies one major behind for a documented reason (template and Aura peer
requirements).
