# ice-cream-dataops

Cognite Data Fusion (CDF) Bootcamp, project 33: an end-to-end solution for the fictional
**Ice Cream Factory**, defined as code and deployed with the
[Cognite Toolkit](https://docs.cognite.com/cdf/deploy/cdf_toolkit/).

The pipeline ingests assets and time series from the Ice Cream REST API, builds the asset
hierarchy on the Cognite Core Data Model, computes **Overall Equipment Effectiveness**
(OEE = quality × performance × availability) and orchestrates the whole chain with a
Data Workflow. The result is used in Charts and Canvas.

## Pipeline

| Stage | Resource | Where |
|---|---|---|
| Access | Groups mapped to Entra ID groups, data sets, spaces | `auth/`, `data_sets/`, `data_models/` of each module |
| Extraction | Hosted extractor: assets to RAW (`ice-cream-factory-db`), time series from the REST API | `ice_cream_api/hosted_extractors/`, `ice_cream_api/raw/` |
| Extraction | `icapi_datapoints_extractor` Cognite Function with its extraction pipeline | `ice_cream_api/functions/`, `ice_cream_api/extraction_pipelines/` |
| Modeling | `create_asset_hierarchy` and `contextualize_ts_assets` Transformations | `ice_cream_api/transformations/` |
| Calculation | `oee_timeseries` Cognite Function: `quality`, `availability`, `performance`, `oee`, `off_spec` | `use_cases/oee/functions/` |
| Orchestration | `wf_icapi_data_pipeline` Data Workflow with its trigger | `ice_cream_api/workflows/` |

## Repository layout

```
cdf.toml                 Toolkit settings (modules version 0.6.53)
config.test.yaml         variables and selected modules for cdf-bootcamp-33-test
config.prod.yaml         variables and selected modules for cdf-bootcamp-33-prod
modules/bootcamp/
  data_foundation/       user access group
  ice_cream_api/         extraction, RAW, transformations, function, workflow
  use_cases/oee/         OEE calculation function, its group, data set and space
scripts/                 read-only checks and repair helpers (Python, Cognite SDK)
icf-oee/                 Flows custom app (React, Vite) showing the OEE results
PID_ICF.pdf              P&ID uploaded as a CogniteFile
JOURNAL.md               progress log (French)
AGENTS.md                working instructions for the AI coding assistant
```

## Prerequisites

- Python 3.10 or later and `cognite-toolkit` **0.6.53** (the version used by the bootcamp
  material).
- One service principal per role and per environment, each member of the Entra ID group
  mapped to its CDF group.
- A `.env` file for test and a `.env.prod` file for prod. Both are ignored by git and never
  committed. Variables referenced by the configuration:

  `CDF_PROJECT`, `CDF_CLUSTER`, `LOGIN_FLOW`, `IDP_TENANT_ID`, `IDP_TOKEN_URL`, `IDP_SCOPES`,
  `IDP_CLIENT_ID`, `IDP_CLIENT_SECRET`, `DATA_DEVELOPER_SOURCE_ID`,
  `ICAPI_EXTRACTORS_CLIENT_ID`, `ICAPI_EXTRACTORS_CLIENT_SECRET`,
  `ICAPI_EXTRACTORS_SOURCE_ID`, `DATA_PIPELINE_OEE_CLIENT_ID`,
  `DATA_PIPELINE_OEE_CLIENT_SECRET`, `DATA_PIPELINE_OEE_SOURCE_ID`

## Deploy

Test, using `.env` and the default `build/` folder:

```sh
cdf auth verify
cdf build --env=test
cdf deploy --dry-run
cdf deploy
```

Prod, with its own env file and build folder passed explicitly, so that a plain
`cdf deploy` can never reach prod:

```sh
cdf --env-path .env.prod auth verify
cdf --env-path .env.prod build --env=prod --build-dir build_prod
cdf --env-path .env.prod deploy build_prod --env=prod --dry-run
cdf --env-path .env.prod deploy build_prod --env=prod
```

Deployment is run from a workstation with the Toolkit. This repository has no GitHub
Actions workflow yet.

## Checks

```sh
python scripts/check_project.py                        # test, expects ALL CHECKS OK
python scripts/check_project.py --env-file .env.prod   # prod
```

`scripts/repair_asset_paths.py` controls and repairs the asset `path` property, and
`scripts/upload_pid.py` controls and uploads the P&ID file. Both are read-only unless
`--apply` is passed. `build_report.py` and `build_memo.js` generate a write-up of the
bootcamp that is kept outside this repository.

## Flows app

`icf-oee/` is a custom app built with `@cognite/cli`, linked to the test project.

```sh
cd icf-oee
npm install
npm run dev
```
