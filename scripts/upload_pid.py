"""Upload the P&ID drawing as a CogniteFile and link it to its assets (bootcamp day 4, Canvas exercise).

This is the bootcamp's createFile.py, run locally instead of in a Fusion Jupyter notebook:
  1. create the file node `file_PID` in the space `icapi_dm_space`;
  2. upload the content of PID_ICF.pdf into it;
  3. rename it "PID Exercise File" and link it to seven Oslo assets, so Canvas can find related data.

Usage (from the project folder, with the Toolkit venv):
    python scripts/upload_pid.py --env-file .env.prod            # read-only: show what would be done
    python scripts/upload_pid.py --env-file .env.prod --apply    # write to the CDF project named in the env file
    (on a non-test project, --apply also requires the environment variable ALLOW_NON_TEST=yes)

Credentials are read from the env file (Toolkit service principal); nothing secret is printed.
"""
from __future__ import annotations

import argparse
import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

from cognite.client import ClientConfig, CogniteClient, global_config
from cognite.client.credentials import OAuthClientCredentials
from cognite.client.data_classes.data_modeling import NodeId, ViewId
from cognite.client.data_classes.data_modeling.cdm.v1 import CogniteFile, CogniteFileApply, DirectRelationReference
from dotenv import load_dotenv

global_config.disable_pypi_version_check = True

SPACE = "icapi_dm_space"
FILE_ID = NodeId(SPACE, "file_PID")
ASSET = ViewId("cdf_cdm", "CogniteAsset", "v1")
# The seven assets named in the bootcamp documentation
ASSETS = ["OSPRPATA241", "OSPRMITA243", "OSPRPAHEEX637", "OSPRMOBRTA115", "OSPRMOWR541", "OSPRAGTA812", "OSPRFRDO232"]


def get_client(env_file: str) -> tuple[CogniteClient, str]:
    if not Path(env_file).is_file():
        sys.exit(f"STOP: env file not found: {env_file}")
    load_dotenv(env_file, override=True)
    cluster, project = os.environ["CDF_CLUSTER"], os.environ["CDF_PROJECT"]
    client = CogniteClient(
        ClientConfig(
            client_name="bootcamp-33-upload-pid",
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


def describe(client: CogniteClient) -> bool:
    """Print the current state of the file node. Return True if it is uploaded and linked to all assets."""
    node = client.data_modeling.instances.retrieve_nodes(nodes=FILE_ID, node_cls=CogniteFile)
    if node is None:
        print("file node file_PID: does not exist yet")
        return False
    linked = sorted(a.external_id for a in (node.assets or []))
    print(f"file node file_PID: name={node.name!r} | content uploaded={node.is_uploaded} | linked assets={len(linked)}")
    missing = sorted(set(ASSETS) - set(linked))
    if missing:
        print("  not linked yet:", missing)
    return bool(node.is_uploaded) and not missing and node.name == "PID Exercise File"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write to CDF (default: read-only report)")
    parser.add_argument("--env-file", default=".env", help="env file to read (default: .env = test; .env.prod = prod)")
    parser.add_argument("--file", default="PID_ICF.pdf", help="path of the P&ID file (default: PID_ICF.pdf in the project folder)")
    args = parser.parse_args()

    pdf = Path(args.file)
    if not pdf.is_file():
        sys.exit(f"STOP: file not found: {pdf}")
    client, project = get_client(args.env_file)
    print(f"project: {project} | space: {SPACE}")
    print(f"local file: {pdf.name} ({pdf.stat().st_size / 1024:.0f} KB)")

    found = {n.external_id: n.properties.get(ASSET, {}).get("name") for n in
             client.data_modeling.instances.retrieve(nodes=[NodeId(SPACE, a) for a in ASSETS], sources=ASSET).nodes}
    for asset in ASSETS:
        print(f"  asset {asset}: {'found, ' + repr(found[asset]) if asset in found else 'MISSING'}")
    if len(found) != len(ASSETS):
        print("STOP: some assets do not exist in this project; run the asset hierarchy first.")
        return 1
    already_done = describe(client)

    if not args.apply:
        print("\nRead-only run: nothing was written. Add --apply to create the file, upload it and link it.")
        return 0
    if not project.endswith("-test") and os.environ.get("ALLOW_NON_TEST") != "yes":
        print("STOP: CDF_PROJECT is not a test project. Set ALLOW_NON_TEST=yes to run it there on purpose.")
        return 1
    if already_done:
        print("\nNothing to do: the file is already uploaded, named and linked.")
        return 0

    print("\n[1/3] creating the file node")
    client.data_modeling.instances.apply(CogniteFileApply(name=pdf.name, space=SPACE, external_id=FILE_ID.external_id))
    print("[2/3] uploading the content")
    client.files.upload_content(str(pdf), instance_id=FILE_ID)
    print("[3/3] renaming the file and linking it to its assets")
    client.data_modeling.instances.apply(
        CogniteFileApply(
            space=SPACE,
            name="PID Exercise File",
            external_id=FILE_ID.external_id,
            assets=[DirectRelationReference(SPACE, a) for a in ASSETS],
        )
    )
    print()
    ok = describe(client)
    print("DONE" if ok else "NOT COMPLETE: see the state above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
