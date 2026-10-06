"""Repair the system-computed `path` of CogniteAsset nodes.

Why: CDF computes `path` (the list of ancestors) once, when a node's `parent` is written, from
what exists at that moment. When create_asset_hierarchy writes a child before its parent, the
child ends up with an empty or truncated `path`, and re-running the transformation is a no-op.
The bootcamp functions find the time series of a site through `path`, so those assets are skipped.

How: for every asset whose `path` differs from its real chain of parents, detach it (parent = null)
and re-attach it to the same parent. This is done level by level, top-down, so the parent always
has a correct `path` when the child is recomputed.

Usage (from the project folder, with the Toolkit venv):
    python scripts/repair_asset_paths.py            # read-only: show what would be done
    python scripts/repair_asset_paths.py --apply    # write to the CDF project named in .env
    python scripts/repair_asset_paths.py --env-file .env.prod            # same, on the prod project
    (on a non-test project, --apply also requires the environment variable ALLOW_NON_TEST=yes)

Only the `parent` property of the broken assets is written, and it always ends on its original
value. Credentials are read from .env (Toolkit service principal); nothing secret is printed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore")

from cognite.client import ClientConfig, CogniteClient, global_config
from cognite.client.credentials import OAuthClientCredentials
from cognite.client.data_classes.data_modeling import NodeApply, NodeId, NodeOrEdgeData, ViewId
from dotenv import load_dotenv

global_config.disable_pypi_version_check = True

SPACE = "icapi_dm_space"
ASSET = ViewId("cdf_cdm", "CogniteAsset", "v1")
WAIT_SECONDS = 180  # how long to wait for CDF to recompute paths after a write
POLL_SECONDS = 5
CHUNK = 500


def get_client(env_file: str) -> tuple[CogniteClient, str]:
    if not Path(env_file).is_file():
        sys.exit(f"STOP: env file not found: {env_file}")
    load_dotenv(env_file, override=True)
    cluster, project = os.environ["CDF_CLUSTER"], os.environ["CDF_PROJECT"]
    client = CogniteClient(
        ClientConfig(
            client_name="bootcamp-33-repair-asset-paths",
            project=project,
            base_url=f"https://{cluster}.cognitedata.com",
            credentials=OAuthClientCredentials(
                token_url=os.environ["IDP_TOKEN_URL"],
                client_id=os.environ["IDP_CLIENT_ID"],
                client_secret=os.environ["IDP_CLIENT_SECRET"],
                scopes=[f"https://{cluster}.cognitedata.com/.default"],
            ),
        )
    )
    return client, project


def read_all(client: CogniteClient) -> tuple[dict[str, str | None], dict[str, list[str]]]:
    """Return ({asset: parent or None}, {asset: system path as a list of external IDs})."""
    nodes = client.data_modeling.instances.list(instance_type="node", space=SPACE, sources=ASSET, limit=None)
    parents, paths = {}, {}
    for node in nodes:
        props = node.properties.get(ASSET, {})
        parents[node.external_id] = (props.get("parent") or {}).get("externalId")
        paths[node.external_id] = [step["externalId"] for step in (props.get("path") or [])]
    return parents, paths


def read_paths(client: CogniteClient, external_ids: list[str]) -> dict[str, list[str]]:
    paths = {}
    for i in range(0, len(external_ids), CHUNK):
        ids = [NodeId(SPACE, e) for e in external_ids[i : i + CHUNK]]
        for node in client.data_modeling.instances.retrieve(nodes=ids, sources=ASSET).nodes:
            props = node.properties.get(ASSET, {})
            paths[node.external_id] = [step["externalId"] for step in (props.get("path") or [])]
    return paths


def true_chain(asset: str, parents: dict[str, str | None]) -> list[str]:
    chain = [asset]
    while parents.get(asset):
        asset = parents[asset]
        chain.append(asset)
    return chain[::-1]


def write_parent(client: CogniteClient, assignments: dict[str, str | None]) -> None:
    """Set `parent` for each asset; None detaches the asset."""
    items = list(assignments.items())
    for i in range(0, len(items), CHUNK):
        client.data_modeling.instances.apply(
            nodes=[
                NodeApply(
                    space=SPACE,
                    external_id=asset,
                    sources=[
                        NodeOrEdgeData(
                            source=ASSET,
                            properties={"parent": {"space": SPACE, "externalId": parent} if parent else None},
                        )
                    ],
                )
                for asset, parent in items[i : i + CHUNK]
            ],
            replace=False,
        )


def wait_for(client: CogniteClient, expected: dict[str, list[str]], label: str) -> list[str]:
    """Poll until every asset has the expected path. Return the assets that still differ."""
    deadline = time.time() + WAIT_SECONDS
    pending = list(expected)
    while True:
        current = read_paths(client, pending)
        pending = [e for e in pending if current.get(e, []) != expected[e]]
        if not pending or time.time() > deadline:
            break
        time.sleep(POLL_SECONDS)
    state = "OK" if not pending else f"{len(pending)} NOT converged after {WAIT_SECONDS}s"
    print(f"    {label}: {len(expected) - len(pending)}/{len(expected)} as expected -> {state}")
    return pending


def toggle(client: CogniteClient, assets: list[str], parents: dict[str, str | None]) -> bool:
    """Detach then re-attach the given assets. Always re-attaches. Return True if all paths end up correct."""
    detached_ok = False
    try:
        write_parent(client, {a: None for a in assets})
        detached_ok = not wait_for(client, {a: [a] for a in assets}, "detached (path = itself)")
    finally:
        write_parent(client, {a: parents[a] for a in assets})  # always restore the real parent
    reattached_ok = not wait_for(client, {a: true_chain(a, parents) for a in assets}, "re-attached (full path)")
    if not detached_ok:
        print("    note: CDF did not recompute the path after the detach within the wait time")
    return reattached_ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write to CDF (default: read-only report)")
    parser.add_argument("--env-file", default=".env", help="env file to read (default: .env = test; .env.prod = prod)")
    args = parser.parse_args()

    client, project = get_client(args.env_file)
    parents, paths = read_all(client)
    broken = sorted((a for a in parents if paths[a] != true_chain(a, parents)), key=lambda a: len(true_chain(a, parents)))
    by_depth = Counter(len(true_chain(a, parents)) for a in broken)
    print(f"project: {project} | space: {SPACE}")
    print(f"assets: {len(parents)} | correct path: {len(parents) - len(broken)} | to repair: {len(broken)}")
    print("to repair, by depth in the hierarchy:", dict(sorted(by_depth.items())))

    if not broken:
        print("Nothing to do: every asset has a complete path.")
        return 0
    if any(not parents[a] for a in broken):
        print("STOP: a root asset has a wrong path; this script does not handle that case.")
        return 1

    pilot = broken[0]
    print(f"pilot asset (done first, alone): {pilot} | parent: {parents[pilot]}")
    if not args.apply:
        print("\nRead-only run: nothing was written. Add --apply to repair.")
        return 0
    if not project.endswith("-test") and os.environ.get("ALLOW_NON_TEST") != "yes":
        print("STOP: CDF_PROJECT is not a test project. Set ALLOW_NON_TEST=yes to run it there on purpose.")
        return 1

    backup = Path("scripts") / f"asset_parents_backup_{project}_{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json"
    backup.write_text(json.dumps(parents, indent=1, sort_keys=True), encoding="utf-8")
    print(f"backup of all parent links written to {backup.as_posix()}")

    print(f"\n[pilot] {pilot}")
    if not toggle(client, [pilot], parents):
        print("STOP: the pilot asset did not get a correct path. Nothing else was touched; its parent is restored.")
        return 1

    for depth in sorted(by_depth):
        level = [a for a in broken if len(true_chain(a, parents)) == depth and a != pilot]
        if not level:
            continue
        print(f"\n[depth {depth}] {len(level)} assets")
        if not toggle(client, level, parents):
            print("STOP: this level did not fully converge; deeper levels were not touched. Parents are restored.")
            return 1

    new_parents, new_paths = read_all(client)
    still = [a for a in new_parents if new_paths[a] != true_chain(a, new_parents)]
    changed = [a for a in parents if new_parents.get(a) != parents[a]]
    print(f"\nfinal check: {len(new_parents) - len(still)}/{len(new_parents)} assets with a correct path")
    print(f"parent links different from the backup: {len(changed)} (must be 0)")
    return 0 if not still and not changed else 1


if __name__ == "__main__":
    sys.exit(main())
