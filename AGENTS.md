# CDF Bootcamp — project 33

Working folder for the Cognite Data Fusion (CDF) Bootcamp, 5–8 October 2026.
Owner: Gaétan Desbrueres (TotalEnergies, EOS Engineer, CDF Technical Referent for CLOV).

## What we are building

An end-to-end, reproducible CDF solution for the bootcamp's fictional **Ice Cream Factory**:
ingest asset and time series data from the Ice Cream REST API, model it, compute
**Overall Equipment Effectiveness (OEE = quality × performance × availability)**, orchestrate
the pipeline, and visualize it in Charts and Canvas.

Everything is defined as code and deployed with the **Cognite Toolkit (`cdf`)**.

**GitHub (since 2026-10-06).** The project is mirrored in the private repository
`EOSGaetan/ice-cream-dataops`, through a clone at `C:\dev\cdf-bootcamp-33` (outside this
synced folder). This folder stays the complete local copy and is not a git repository: do not
run `git init` here. Kept out of the repository: `.env*`, `build/`, `build_prod/`, the deck
PDF, `report/`, the root `.claude/`, and in `icf-oee/` its `.git`, `node_modules` and `dist`.
A change made in one folder must be copied to the other. I run every `git commit` and
`git push` myself; you prepare the clone (copy files, `git add`, `.gitignore`) and verify
after the push. The Object IDs below must be removed (history included) before the repository
is ever made public. No GitHub Actions yet: do not run `cdf repo init` or add workflows
unless I ask.

## Schedule

| Day | Theme | Deliverables |
|---|---|---|
| Mon | Data Foundations | Service principals, groups, datasets, spaces, RAW databases deployed with the Toolkit |
| Tue | Data Integration A + Data Modeling | Two hosted extractors (assets CSV → RAW, time series from REST API); Transformations for the asset hierarchy and time series contextualization |
| Wed | Data Integration B + Orchestration | Extraction pipelines, `icapi_datapoints_extractor` and `oee_calculation` as Cognite Functions, Data Workflows |
| Thu | Charts and Canvas | OEE in Charts, troubleshooting in Canvas |

## Environment

| Item | Value |
|---|---|
| CDF organization | `cog-enablement-bootcamp` |
| Fusion login | https://fusion.cognite.com/ |
| Project number | 33 |
| CDF project (test) | `cdf-bootcamp-33-test` (naming pattern given in the bootcamp docs) |
| CDF project (prod) | `cdf-bootcamp-33-prod` |
| CDF cluster | `westeurope-1` (`https://westeurope-1.cognitedata.com`) |
| Identity provider | Microsoft Entra ID (bootcamp tenant, **not** the TotalEnergies tenant) |
| Bootcamp docs | https://docs.cdf-bootcamp.cogniteapp.com/ (behind a Microsoft login; I paste the pages) |
| Toolkit docs | https://docs.cognite.com/cdf/deploy/cdf_toolkit/ |
| Cognite docs MCP server | https://docs.cognite.com/mcp, added to Claude Code as `cognite-docs` (search of the public Cognite docs; the bootcamp docs are not in it) |
| Requirements | Python 3.10+, `cognite-toolkit` |
| Toolkit install | `cognite-toolkit` **0.6.53** (version pinned by the bootcamp docs; do not upgrade, 0.8 rejects the docs' config) in a Python 3.13 venv at `%USERPROFILE%\.venvs\cdf33` (outside this synced folder); CLI is `%USERPROFILE%\.venvs\cdf33\Scripts\cdf.exe` |

This is a training tenant. It has nothing to do with `totalenergies-clov`; never point
commands at that project from this folder.

## Entra ID groups

CDF groups are mapped to these Entra groups through their Object ID (`sourceId` in the
group YAML). Fill in the Object IDs as they are collected.

| Entra group | Purpose | Member | Object ID |
|---|---|---|---|
| `bootcamp-33-test-admin-tk` | Toolkit deployment, test | Toolkit service principal | `ab5b9544-00bf-480b-b77a-b66d9a915da3` |
| `bootcamp-33-prod-admin-tk` | Toolkit deployment, prod | Toolkit service principal | `b0f53977-fbf4-4229-997e-7419859f7aac` |
| `bootcamp-33-test-icapi-extractors` | Extractors, extraction pipelines and the RAW databases/tables they need | Extractors service principal | `2643ec99-c30e-4174-afa5-19099f1cabde` |
| `bootcamp-33-prod-icapi-extractors` | Same, prod | Extractors service principal | `72b26782-146e-4880-a435-2d0d6edbf03b` |
| `bootcamp-33-test-data-pipeline-oee` | Transformations, functions and data workflows for the OEE use case | OEE service principal | `2b730c9c-e4f8-4962-a2b0-05c0ea80ce31` |
| `bootcamp-33-prod-data-pipeline-oee` | Same, prod | OEE service principal | `43d62c27-6850-4966-86a1-0b8f75c7ca4f` |
| `bootcamp-33-test-data-developer` | User access to the CDF UI, test | Me, via `bootcamp-33-participant` | `bb593f90-7fc3-4873-bc86-23823a44a5ce` |
| `bootcamp-33-prod-data-developer` | User access to the CDF UI, prod | Me, via `bootcamp-33-participant` | `01537347-30fa-4bfb-b39a-1af446881ebd` |
| `bootcamp-33-prod-data-explorer` | Presumably read-only user access, prod | Users | `8787e65c-8086-4cd6-ae42-44de05725149` |
| `bootcamp-33-participant` | Bootcamp participants | Me | `3a750ccb-6181-4f4f-ad80-f9b519478313` |

Service principals: one per role and per environment, six in total. The bootcamp docs name
them `bootcamp-<n>-<env>-<cdf group postfix>-app`; mine were created **without** the `-app`
suffix, so each app has the same name as its group (e.g. app `bootcamp-33-test-admin-tk`
in group `bootcamp-33-test-admin-tk`). Harmless: CDF matches on the client ID.

## Secrets — hard rules

- Secrets live only in `.env` (test) and `.env.prod` (prod): tenant ID, client IDs, client
  secrets. Never print them, never copy them into another file, never include them in a
  summary or a commit.
- Do not read `.env` or `.env.prod` aloud. If a value is needed to debug, ask me to check it
  myself, or test its shape with true/false checks that never display it.
- YAML files reference secrets as `${VARIABLE_NAME}`; never hard-code a secret value.
- If a `.gitignore` ever exists here, `.env` must be in it.

Expected `.env` variables (names only):
`CDF_PROJECT`, `IDP_CLIENT_ID`, `IDP_CLIENT_SECRET`, `DATA_DEVELOPER_SOURCE_ID`,
`DATA_PIPELINE_OEE_CLIENT_ID`, `DATA_PIPELINE_OEE_CLIENT_SECRET`,
`DATA_PIPELINE_OEE_SOURCE_ID`, `ICAPI_EXTRACTORS_CLIENT_ID`,
`ICAPI_EXTRACTORS_CLIENT_SECRET`, `ICAPI_EXTRACTORS_SOURCE_ID`, `LOGIN_FLOW`,
`CDF_CLUSTER`, `IDP_TENANT_ID`, `IDP_TOKEN_URL` (list from the bootcamp docs; the Object
IDs above were transcribed from a screenshot on 2026-10-05).

## Toolkit workflow

```sh
cdf --version              # check the install
cdf auth verify            # check credentials and the Toolkit group; prompts y/n, so I run it myself in a terminal
cdf build --env=test       # compile modules into build/ using config.test.yaml
cdf deploy --dry-run       # show what would change, changes nothing
cdf deploy                 # apply to the CDF project in .env
cdf clean --dry-run        # show what a clean would delete
```

Prod uses its own env file and its own build folder, always passed explicitly, so a plain
`cdf deploy` can never reach prod:

```sh
cdf --env-path .env.prod auth verify
cdf --env-path .env.prod build --env=prod --build-dir build_prod
cdf --env-path .env.prod deploy build_prod --env=prod --dry-run
cdf --env-path .env.prod deploy build_prod --env=prod
```

I run every real `cdf deploy` myself in the terminal (test and prod); you prepare the
files, run `build` and `deploy --dry-run`, and check the result in CDF afterwards.

Rules for you:

- **Always run `cdf build` then `cdf deploy --dry-run` and show me the result before any
  real `cdf deploy`.**
- **Never run `cdf deploy` against prod, `cdf clean`, or any delete without my explicit
  go-ahead in the same conversation.** Test first, then prod.
- Before deploying, confirm which project `.env` points to (`CDF_PROJECT`).
- If the installed Toolkit version rejects a command or flag above, check `cdf --help`
  rather than guessing; the CLI changes between versions.
- If `pip`/`uv` fails with a timeout or SSL error, it is likely the corporate proxy:
  report the exact error instead of retrying with TLS verification disabled.
- Zscaler re-signs TLS to `*.cognitedata.com` on the TotalEnergies network, so Python fails
  with `CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate`. Fixed in the
  venv with `pip-system-certs` (Python uses the Windows certificate store; verification
  stays on). Reinstall it if the venv is recreated.
- On Windows, paths over 260 characters break deployment; keep this folder close to the
  drive root and module names short.

## Folder layout (Toolkit convention)

```
cdf.toml                 # Toolkit settings and version
config.test.yaml         # variables + selected modules for test
config.prod.yaml         # variables + selected modules for prod
.env                     # test secrets, never shared
.env.prod                # prod secrets, never shared; only used with --env-path .env.prod
modules/bootcamp/        # data_foundation, ice_cream_api, use_cases/oee; one subfolder per resource type
build/                   # generated by cdf build (test), never edit by hand
build_prod/              # generated by the prod build, never edit by hand
JOURNAL.md               # progress log in French: current state, next steps, problems solved
report/                  # shareable bilingual (FR/EN) HTML write-up, one tab per bootcamp day
scripts/                 # helper scripts I run myself with the venv's python (read-only unless --apply)
icf-oee/                 # Flows custom app (React/Vite, `@cognite/cli`), linked to the test project; own git repo created by the CLI, own AGENTS.md; see JOURNAL.md
```

`report/cdf-bootcamp-report.src.html` is the source to edit; `report/CDF-Bootcamp-Report.html`
is the generated page to share. Regenerate it with
`python scripts/build_report.py <skill_dir>`, where `<skill_dir>` is the folder of the
`eos-dashboard-branding` skill: the script applies the EOS branding (`embed_branding.py`) and
embeds the screenshots of `report/img/` as data URIs, so the page stays a single file (about
1.7 MB). Do not call `embed_branding.py` directly any more: the images would stay as relative
links. The page holds fourteen screenshots taken on 2026-10-06 in prod
(`report/img/day1-*.jpg` to `day4-*.jpg`): day 4 has its own panel "Les écrans dans Fusion",
days 1 to 3 show theirs at the end of an existing panel. The Summary tab also holds the
evaluation rubric with our position, a quiz-preparation panel and the Cognite resources. To
check the rendering, Chrome headless works on this machine
(`chrome --headless=new --screenshot=out.png "file:///...#day2"`); Edge headless does not.
At the end of each day, fill in that day's tab in the source and
update the Summary tab (KPIs, pipeline stage statuses, progress table, key lessons, open
points), keeping every text in both `data-l="fr"` and `data-l="en"`, then regenerate. The page is
meant to be shared: no secret, client ID, tenant ID or Object ID in it.

The HTML page has a "Mode opératoire / Procedure" tab (`<section id="proc">`): the full
step-by-step procedure, to keep in line with what is actually done. Its phase 13
(`<section id="proc-13">`) explains how to move this local project to a GitHub repository and
deploy with GitHub Actions; it is **documented only, not executed** (badge "documented, not
executed"), so the "work locally only" rule above still holds until I say otherwise.
`report/CDF-Bootcamp-Memo.docx`
is an English-only Word memo (executive summary, data, issues, lessons), dated 6 October 2026;
it is generated by a docx-js script, so regenerate it rather than patching the file, and only
when it is not open in Word.

`scripts/check_project.py` is the read-only health check of a project (21 controls, expects
`ALL CHECKS OK`); `scripts/repair_asset_paths.py` controls and repairs the asset `path`
property; `scripts/upload_pid.py` controls (and can upload) the P&ID `CogniteFile`. All take
`--env-file .env.prod` for prod. `scripts/build_memo.js` generates the Word memo
(`node scripts/build_memo.js <logo.png> <output.docx> [img_dir]`, with `NODE_PATH` pointing to
a folder where the npm package `docx` is installed); its Appendix C reuses the screenshots of
`report/img/`. `scripts/build_report.py` generates the HTML page.

Status on 2026-10-06: the four bootcamp days are done in test and prod, Charts and Canvas
included. The repository is public, its GitHub environments `test` and `prod` are configured
(11 variables and 3 secrets each; `prod` has a required reviewer and deploys from `main`
only), and I submitted the manually graded part of the final assessment. Not done: branch
protection on `main` and the GitHub Actions workflows; see JOURNAL.md for the open points. In Fusion you can drive the UI for me through the app's built-in browser once I
have signed in there myself.

`JOURNAL.md` is the handover file. Read it at the start of a session and update it
whenever a step is finished, a problem is solved or the next steps change.

A **module** is a bundle of resource configuration files (groups, datasets, spaces, RAW,
extraction pipelines, hosted extractors, transformations, functions, workflows), each file
defining one CDF resource.

## Domain reference

- **Sites:** Oslo, Hannover, Nuremberg, Rotterdam, London, Marseille, Chicago, Houston,
  São Paulo, Kuala Lumpur.
- **Site areas:** Receiving & Raw Material, Production, Cold Store, Product. Production
  has one, two or three branches depending on site size.
- **Naming standard:** ISA-95.
- **Input time series per unit:** `count`, `good`, `status`, `planned_status`.
- **Output time series from `oee_calculation`:** `quality`, `availability`,
  `performance`, `oee`, `off_spec`.
- **RAW:** database `ice-cream-factory-db`, table `assets`.
- **Data source:** Ice Cream REST API (ICAPI) — `site/all/csv` for assets,
  `timeseries/oee` for time series.
- **Data model:** Cognite Core Data Model (`cdf_cdm` space) — `CogniteAsset`,
  `CogniteTimeSeries`, `CogniteFile`, `CogniteActivity`; extended with views such as
  `IceCreamAsset`.
- **Extractor vocabulary:** backfill (history before the first datapoint in CDF),
  frontfill (history after the last datapoint), streaming (real time).
- **Workflow task fields:** `externalId`, `type`, `parameters`, `retries`, `timeout`,
  `dependsOn`. Transformation concurrency policy: `fail` (default), `waitForCurrent`,
  `restartAfterCurrent`.

## Known traps (from my CLOV work)

- External IDs must match exactly between Transformations and SDK code; a stray prefix
  or separator silently breaks the link.
- RAW has no schema enforcement: a mismatched key gives NULL links (for example a NULL
  asset reference) with no error. After every transformation, check row counts and NULLs.

## Evaluation (what "done" means)

- All data present in **both test and prod**, not only test.
- A complete Canvas.
- A post-bootcamp multiple-choice quiz, pass mark 70%.
- The deck also grades a GitHub repository; we are working locally, so confirm with the
  instructor how that part is assessed.
- Weights, from the deck (`2025- Cognite Data Fusion Bootcamp v3.pdf`, slide 10): CDF projects
  40%, GitHub repository 20%, Canvas 20%, post-bootcamp quiz 20%; pass at 70%. The deck also
  holds an older rubric (slide 113: 50/10/20/20, four levels) and a sample quiz (slides
  116-120) whose answer on weights contradicts both: slide 10 is the one to trust until the
  instructor says otherwise. Slide 112 adds a condition to confirm: the "CDF Fundamentals"
  path of Cognite Academy completed.
- The deck is Cognite's material: reuse its ideas in the report in our own words and with our
  own diagrams and screenshots; do not paste its slides, nor the instructor's name or e-mail.

## How I want you to work

- Respond in French: the topic is new to me. Keep commands, YAML, file contents and CDF
  terms (group, dataset, space, RAW…) in English, as in the bootcamp material.
- Explain what a command or YAML block does before running or writing it; I am here to
  learn the platform, not only to finish the exercises.
- Give steps with a clear order and say which ones I must do myself (Entra portal,
  Fusion UI) versus which you can do in this folder.
- Make targeted edits to existing files rather than rewriting them.
- When something fails, show the exact error and the most likely cause first.
- If the bootcamp docs and this file disagree, the bootcamp docs win; tell me and update
  this file.
