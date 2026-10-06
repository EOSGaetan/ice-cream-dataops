"""Read-only health check of a bootcamp CDF project: access, extractors, hierarchy, time series, OEE, workflow.

Usage (from the project folder, with the Toolkit venv):
    python scripts/check_project.py                        # test project (.env)
    python scripts/check_project.py --env-file .env.prod   # prod project

Nothing is written to CDF and no secret is printed. Each line starts with OK, WARN or INFO.
Expected values are those of the Ice Cream Factory bootcamp (1021 assets, 2512 + 3140 time series).
"""
from __future__ import annotations

import argparse
import os
import sys
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore")

from cognite.client import ClientConfig, CogniteClient, global_config
from cognite.client.credentials import OAuthClientCredentials
from cognite.client.data_classes.data_modeling import NodeId, ViewId
from dotenv import load_dotenv

global_config.disable_pypi_version_check = True

SPACE, OEE_SPACE = "icapi_dm_space", "oee_ts_space"
ASSET, TS = ViewId("cdf_cdm", "CogniteAsset", "v1"), ViewId("cdf_cdm", "CogniteTimeSeries", "v1")
EXPECTED_ASSETS, EXPECTED_ROOTS, EXPECTED_TS, EXPECTED_OEE = 1021, 10, 2512, 3140
PRINCIPALS = {
    "Toolkit": ("IDP_CLIENT_ID", "IDP_CLIENT_SECRET", "cognite_toolkit_service_principal"),
    "ICAPI extractors": ("ICAPI_EXTRACTORS_CLIENT_ID", "ICAPI_EXTRACTORS_CLIENT_SECRET", "icapi_extractors"),
    "Data pipeline OEE": ("DATA_PIPELINE_OEE_CLIENT_ID", "DATA_PIPELINE_OEE_CLIENT_SECRET", "data_pipeline_oee"),
}
warn_count = 0


def line(ok: bool | None, text: str) -> None:
    global warn_count
    if ok is False:
        warn_count += 1
    print(f"  {'INFO' if ok is None else 'OK  ' if ok else 'WARN'}  {text}")


def make_client(id_var: str, secret_var: str) -> CogniteClient:
    cluster, project = os.environ["CDF_CLUSTER"], os.environ["CDF_PROJECT"]
    return CogniteClient(
        ClientConfig(
            client_name="bootcamp-check-project",
            project=project,
            base_url=f"https://{cluster}.cognitedata.com",
            credentials=OAuthClientCredentials(
                token_url=os.environ["IDP_TOKEN_URL"],
                client_id=os.environ[id_var],
                client_secret=os.environ[secret_var],
                scopes=[f"https://{cluster}.cognitedata.com/.default"],
            ),
        )
    )


def hhmm(ms: int | None) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%m-%d %H:%M") if ms else "-"


def section(title: str, check) -> None:
    print(f"\n{title}")
    try:
        check()
    except Exception as e:  # noqa: BLE001  (a failed section must not hide the others)
        line(False, f"could not check: {type(e).__name__}: {str(e)[:160]}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--env-file", default=".env", help="env file to read (default: .env = test; .env.prod = prod)")
    args = parser.parse_args()
    if not Path(args.env_file).is_file():
        sys.exit(f"STOP: env file not found: {args.env_file}")
    load_dotenv(args.env_file, override=True)
    project = os.environ["CDF_PROJECT"]
    client = make_client("IDP_CLIENT_ID", "IDP_CLIENT_SECRET")
    print(f"project: {project} | checked at {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC")

    def access() -> None:
        groups = {g.id: g.name for g in client.iam.groups.list(all=True)}
        for name, (id_var, secret_var, expected) in PRINCIPALS.items():
            insp = make_client(id_var, secret_var).iam.token.inspect()
            mine = sorted(groups.get(g, str(g)) for p in insp.projects if p.url_name == project for g in p.groups)
            line(expected in mine, f"{name}: CDF groups obtained = {mine or 'none'} (expected {expected})")

    def extractors() -> None:
        jobs = client.hosted_extractors.jobs.list(limit=None)
        line(len(jobs) == 2, f"hosted extractor jobs: {len(jobs)} (expected 2)")
        for job in jobs:
            line(str(job.status) in ("running", "ok", "connected", "waiting"), f"job {job.external_id!r}: status={job.status}, target={job.target_status}")
        rows = client.raw.rows.list("ice-cream-factory-db", "assets", limit=None)
        line(len(rows) == EXPECTED_ASSETS, f"RAW ice-cream-factory-db.assets: {len(rows)} rows (expected {EXPECTED_ASSETS})")

    state: dict = {}

    def hierarchy() -> None:
        nodes = client.data_modeling.instances.list(instance_type="node", space=SPACE, sources=ASSET, limit=None)
        parents = {n.external_id: ((n.properties.get(ASSET, {}).get("parent") or {}).get("externalId")) for n in nodes}
        paths = {n.external_id: [s["externalId"] for s in (n.properties.get(ASSET, {}).get("path") or [])] for n in nodes}

        def chain(a: str) -> list[str]:
            out = [a]
            while parents.get(a):
                a = parents[a]
                out.append(a)
            return out[::-1]

        roots = [a for a, p in parents.items() if not p]
        missing = [a for a, p in parents.items() if p and p not in parents]
        broken = [a for a in parents if paths[a] != chain(a)]
        state["assets"] = set(parents)
        line(len(nodes) == EXPECTED_ASSETS, f"CogniteAsset nodes: {len(nodes)} (expected {EXPECTED_ASSETS})")
        line(len(roots) == EXPECTED_ROOTS, f"root assets (the sites): {len(roots)} (expected {EXPECTED_ROOTS})")
        line(not missing, f"assets whose parent does not exist: {len(missing)} (expected 0)")
        line(not broken, f"assets with a missing or truncated path: {len(broken)} (expected 0; fix: scripts/repair_asset_paths.py)")

    def series() -> None:
        nodes = client.data_modeling.instances.list(instance_type="node", space=SPACE, sources=TS, limit=None)
        links = Counter(len((n.properties.get(TS, {}) or {}).get("assets") or []) for n in nodes)
        wrong = sum(
            1
            for n in nodes
            for a in ((n.properties.get(TS, {}) or {}).get("assets") or [])
            if a.get("externalId") != n.external_id.split(":")[0] or a.get("externalId") not in state.get("assets", {a.get("externalId")})
        )
        line(len(nodes) == EXPECTED_TS, f"measured time series: {len(nodes)} (expected {EXPECTED_TS})")
        line(links.get(1, 0) == len(nodes) and not wrong, f"linked to exactly one asset: {links.get(1, 0)}; wrong or dangling links: {wrong}")
        ids = [NodeId(SPACE, n.external_id) for n in nodes]
        with_dp = 0
        for i in range(0, len(ids), 100):
            with_dp += sum(1 for dp in client.time_series.data.retrieve_latest(instance_id=ids[i : i + 100]) if dp.timestamp)
        line(with_dp == len(nodes), f"measured time series containing datapoints: {with_dp} / {len(nodes)}")

    def oee() -> None:
        nodes = client.data_modeling.instances.list(instance_type="node", space=OEE_SPACE, sources=TS, limit=None)
        line(len(nodes) == EXPECTED_OEE, f"OEE time series: {len(nodes)} (expected {EXPECTED_OEE} = 628 units x 5)")
        ids = [NodeId(OEE_SPACE, n.external_id) for n in nodes if n.external_id.endswith(":oee")]
        short, empty = [], 0
        for i in range(0, len(ids), 100):
            res = client.time_series.data.retrieve(instance_id=ids[i : i + 100], start="16d-ago", end="now", aggregates=["count"], granularity="16d")
            for dps in res:
                n = int(sum(dps.count)) if dps.count is not None and len(dps.count) else 0
                empty += n == 0
                if 0 < n < 1000:
                    short.append(dps.instance_id.external_id.split(":")[0])
        line(empty == 0, f"':oee' series without any datapoint: {empty} of {len(ids)}")
        line(not short, f"':oee' series with only a short history (< 1000 points in 16 days): {len(short)} (expected 0; fix: call OEE TimeSeries with lookback_minutes for the missing sites)")
        if short:
            line(None, f"units with a short history start with: {dict(Counter(u[:2] for u in short).most_common(6))}")

    def orchestration() -> None:
        for f in client.functions.list(limit=None):
            line(f.status == "Ready", f"function {f.external_id}: {f.status}")
        runs = make_client("ICAPI_EXTRACTORS_CLIENT_ID", "ICAPI_EXTRACTORS_CLIENT_SECRET").extraction_pipelines.runs.list(external_id="ep_icapi_datapoints", limit=20)
        fails = [r for r in runs if r.status == "failure"]
        line(bool(runs) and not fails, f"extraction pipeline ep_icapi_datapoints: last {len(runs)} runs, {len(fails)} failed; latest = {runs[0].status + ' at ' + hhmm(runs[0].created_time) if runs else 'none'}")
        execs = sorted(client.workflows.executions.list(workflow_version_ids=("wf_icapi_data_pipeline", "1"), limit=10), key=lambda e: e.created_time, reverse=True)
        statuses = Counter(str(e.status) for e in execs)
        line(bool(execs) and str(execs[0].status) in ("completed", "running"), f"workflow wf_icapi_data_pipeline: last {len(execs)} executions = {dict(statuses)}; latest started {hhmm(execs[0].created_time) if execs else '-'}")

    section("1. Access: does each service principal get its CDF group?", access)
    section("2. Hosted extractors and RAW", extractors)
    section("3. Asset hierarchy", hierarchy)
    section("4. Measured time series", series)
    section("5. OEE time series", oee)
    section("6. Functions, extraction pipeline, workflow", orchestration)
    print(f"\n{'ALL CHECKS OK' if not warn_count else str(warn_count) + ' WARNING(S), see the WARN lines above'}")
    return 0 if not warn_count else 1


if __name__ == "__main__":
    sys.exit(main())
