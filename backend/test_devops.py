"""
Azure DevOps connection test.
Run from backend/: python3 test_devops.py
"""
import asyncio
import base64
import os
import sys
import urllib.parse

import httpx
from dotenv import load_dotenv

load_dotenv()

TENANT_ID = os.getenv("AZURE_AD_TENANT_ID", "")
CLIENT_ID = os.getenv("AZURE_AD_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("AZURE_AD_CLIENT_SECRET", "")
ORG = os.getenv("AZURE_DEVOPS_ORG", "")
PROJECTS_RAW = os.getenv("AZURE_DEVOPS_PROJECTS", "")
TEAM = os.getenv("AZURE_DEVOPS_TEAM", "")
PAT = os.getenv("AZURE_DEVOPS_PAT", "")
DEVOPS_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798"

# ── helpers ────────────────────────────────────────────────────────────────────

def ok(msg):   print(f"  ✅  {msg}")
def fail(msg): print(f"  ❌  {msg}"); sys.exit(1)
def warn(msg): print(f"  ⚠️   {msg}")
def section(title): print(f"\n{'─'*60}\n  {title}\n{'─'*60}")

# ── checks ─────────────────────────────────────────────────────────────────────

async def check_env():
    section("1. Environment variables")
    if not TENANT_ID:  fail("AZURE_AD_TENANT_ID is missing")
    ok(f"AZURE_AD_TENANT_ID = {TENANT_ID}")
    if not CLIENT_ID:  fail("AZURE_AD_CLIENT_ID is missing")
    ok(f"AZURE_AD_CLIENT_ID = {CLIENT_ID}")

    if not ORG:
        fail(
            "AZURE_DEVOPS_ORG is missing.\n"
            '  Add to .env:  AZURE_DEVOPS_ORG=TekYantra'
        )
    ok(f"AZURE_DEVOPS_ORG = {ORG}")

    if not PROJECTS_RAW:
        fail(
            'AZURE_DEVOPS_PROJECTS is missing.\n'
            '  Add to .env:  AZURE_DEVOPS_PROJECTS=["KosmicEye","ROCON Infra"]'
        )
    ok(f"AZURE_DEVOPS_PROJECTS (raw) = {PROJECTS_RAW}")

    if PAT:
        ok("AZURE_DEVOPS_PAT = *** (will use PAT auth)")
    elif CLIENT_SECRET:
        ok("AZURE_AD_CLIENT_SECRET = *** (will use service principal OAuth)")
    else:
        fail("Neither AZURE_DEVOPS_PAT nor AZURE_AD_CLIENT_SECRET is set")

    if TEAM:
        ok(f"AZURE_DEVOPS_TEAM = {TEAM}")
    else:
        warn("AZURE_DEVOPS_TEAM not set — will use each project's default team")


def _auth_headers() -> dict:
    if PAT:
        encoded = base64.b64encode(f":{PAT}".encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    raise RuntimeError("No PAT available")


async def get_token() -> str | None:
    """Returns Bearer token if using OAuth, None if using PAT."""
    if PAT:
        return None

    section("2. Token acquisition (service principal → Azure DevOps scope)")
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope": f"{DEVOPS_RESOURCE}/.default",
        })
    if resp.status_code != 200:
        fail(f"Token request failed: HTTP {resp.status_code}\n  Body: {resp.text[:400]}")
    token = resp.json()["access_token"]
    ok(f"Token acquired (length {len(token)})")
    return token


async def check_org():
    section(f"2. Organisation access: dev.azure.com/{ORG}")
    headers = _auth_headers()
    url = f"https://dev.azure.com/{ORG}/_apis/projects?api-version=7.1"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code == 401:
        fail(
            f"HTTP 401 — token/PAT does not have access to org '{ORG}'.\n\n"
            "  If using PAT: ensure the PAT was created for the TekYantra organisation\n"
            "  and has 'Project and Team - Read' scope.\n\n"
            "  If using service principal: the SP must be added to Organisation Settings → Users."
        )
    if resp.status_code == 403:
        fail(f"HTTP 403 — authenticated but no access to org '{ORG}'.")
    if resp.status_code != 200:
        fail(f"Unexpected HTTP {resp.status_code}: {resp.text[:300]}")

    projects = resp.json().get("value", [])
    ok(f"Organisation accessible — {len(projects)} project(s) found:")
    for p in projects:
        print(f"       • {p['name']}")
    return [p["name"] for p in projects]


async def check_project(project: str, org_projects: list[str]):
    section(f"3. Project: '{project}'")
    headers = _auth_headers()

    matched = next((p for p in org_projects if p.lower() == project.lower()), None)
    if not matched:
        warn(
            f"Project '{project}' not found in org. Available:\n"
            + "\n".join(f"       • {p}" for p in org_projects)
        )
        warn("Check spelling/case in AZURE_DEVOPS_PROJECTS — Azure DevOps is case-sensitive.")
        return
    if matched != project:
        warn(f"Case mismatch: AZURE_DEVOPS_PROJECTS has '{project}' but org has '{matched}'. Update .env.")
        project = matched

    ok(f"Project '{project}' exists in org")

    base = f"https://dev.azure.com/{ORG}/{urllib.parse.quote(project)}"
    wiql = {"query": "SELECT [System.Id] FROM WorkItems WHERE [System.IsDeleted] = False ORDER BY [System.ChangedDate] DESC"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{base}/_apis/wit/wiql?api-version=7.1&$top=10",
            headers=headers, json=wiql,
        )
    if resp.status_code == 200:
        ids = resp.json().get("workItems", [])
        ok(f"WIQL query succeeded — {len(ids)} work item(s) returned (top 10)")
    else:
        warn(f"WIQL query failed: HTTP {resp.status_code}: {resp.text[:200]}")

    team_seg = f"/{urllib.parse.quote(TEAM)}" if TEAM else ""
    iter_url = f"{base}{team_seg}/_apis/work/teamsettings/iterations?api-version=7.1"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(iter_url, headers=headers)

    if resp.status_code == 200:
        iters = resp.json().get("value", [])
        current = [i for i in iters if i.get("attributes", {}).get("timeFrame") == "current"]
        past = [i for i in iters if i.get("attributes", {}).get("timeFrame") == "past"]
        ok(f"Iterations endpoint OK — {len(iters)} total | {len(current)} current | {len(past)} past")
        if iters:
            print(f"       Latest: {iters[-1]['name']}")
    elif resp.status_code == 404:
        warn(
            f"Iterations endpoint returned 404 for URL:\n  {iter_url}\n\n"
            + (
                f"  AZURE_DEVOPS_TEAM='{TEAM}' may not exist in project '{project}'.\n"
                "  Either clear AZURE_DEVOPS_TEAM in .env or use the exact team name from:\n"
                f"  https://dev.azure.com/{ORG}/{urllib.parse.quote(project)}/_settings/teams"
                if TEAM else
                "  The default team may have a different name.\n"
                f"  Set AZURE_DEVOPS_TEAM in .env to the exact team name from:\n"
                f"  https://dev.azure.com/{ORG}/{urllib.parse.quote(project)}/_settings/teams"
            )
        )
    else:
        warn(f"Iterations endpoint HTTP {resp.status_code}: {resp.text[:200]}")


async def main():
    print("\n  Azure DevOps Connectivity Test")
    print("  ================================\n")

    await check_env()
    await get_token()
    org_projects = await check_org()

    import json as _json
    try:
        projects = _json.loads(PROJECTS_RAW)
        if isinstance(projects, str):
            projects = [projects]
    except Exception:
        projects = [p.strip() for p in PROJECTS_RAW.split(",") if p.strip()]

    for project in projects:
        await check_project(project, org_projects)

    section("Done")
    print("  All checks passed! Azure DevOps integration should work.\n")
    print("  If sprints still don't load after restarting the backend,")
    print("  run the backend and check the server logs for detailed errors.\n")


asyncio.run(main())
