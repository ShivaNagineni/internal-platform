from __future__ import annotations

import asyncio
import base64
import json
import logging
import urllib.parse

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

DEVOPS_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798"
API_VERSION = "7.1"
SUPPORTED_TYPES = ("User Story", "Task", "Bug")

WORK_ITEM_FIELDS = (
    "System.Id,System.Title,System.WorkItemType,System.State,"
    "System.AssignedTo,System.CreatedDate,System.ChangedDate,"
    "System.Description,Microsoft.VSTS.Common.Priority,"
    "Microsoft.VSTS.TCM.ReproSteps"
)

# ─── Auth & URL helpers ───────────────────────────────────────────────────────

def _get_auth_headers() -> dict[str, str]:
    """Return Authorization header — PAT preferred, OAuth service principal as fallback."""
    settings = get_settings()
    if settings.azure_devops_pat:
        encoded = base64.b64encode(f":{settings.azure_devops_pat}".encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    raise ValueError("AZURE_DEVOPS_PAT is not configured")


def _project_url(project: str) -> str:
    s = get_settings()
    return f"https://dev.azure.com/{s.azure_devops_org}/{urllib.parse.quote(project)}"


def _team_project_url(project: str) -> str:
    s = get_settings()
    base = f"https://dev.azure.com/{s.azure_devops_org}/{urllib.parse.quote(project)}"
    if s.azure_devops_team:
        return f"{base}/{urllib.parse.quote(s.azure_devops_team)}"
    return base


def _web_url(item_id: int, project: str) -> str:
    s = get_settings()
    return (
        f"https://dev.azure.com/{s.azure_devops_org}/"
        f"{urllib.parse.quote(project)}/_workitems/edit/{item_id}"
    )


def _first_project() -> str | None:
    return (get_settings().azure_devops_projects or [None])[0]

# ─── Parsing ──────────────────────────────────────────────────────────────────

def _parse_assigned_to(raw) -> dict | None:
    if isinstance(raw, dict) and raw.get("uniqueName"):
        return {"display_name": raw.get("displayName", ""), "unique_name": raw["uniqueName"]}
    if isinstance(raw, str) and raw:
        return {"display_name": raw, "unique_name": raw}
    return None


def _parse_work_item(item: dict, project: str) -> dict:
    fields = item.get("fields", {})
    description = fields.get("System.Description") or fields.get("Microsoft.VSTS.TCM.ReproSteps")
    return {
        "id": item["id"],
        "project": project,
        "title": fields.get("System.Title", ""),
        "description": description,
        "work_item_type": fields.get("System.WorkItemType", ""),
        "state": fields.get("System.State", ""),
        "assigned_to": _parse_assigned_to(fields.get("System.AssignedTo")),
        "priority": fields.get("Microsoft.VSTS.Common.Priority"),
        "created_date": fields.get("System.CreatedDate"),
        "changed_date": fields.get("System.ChangedDate"),
        "url": _web_url(item["id"], project),
    }

# ─── Shared batch fetch ────────────────────────────────────────────────────────

async def _fetch_work_items_by_ids(ids: list[int], project: str) -> list[dict]:
    if not ids:
        return []
    headers = _get_auth_headers()
    base = _project_url(project)
    results: list[dict] = []
    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(0, len(ids), 200):
            batch = ids[i : i + 200]
            resp = await client.get(
                f"{base}/_apis/wit/workitems",
                headers=headers,
                params={
                    "ids": ",".join(str(x) for x in batch),
                    "fields": WORK_ITEM_FIELDS,
                    "api-version": API_VERSION,
                },
            )
            resp.raise_for_status()
            results.extend(resp.json().get("value", []))
    return results

# ─── Per-project work item listing ───────────────────────────────────────────

async def _list_work_items_for_project(
    project: str, assigned_to_email: str | None = None
) -> list[dict]:
    headers = _get_auth_headers()
    base = _project_url(project)

    type_clause = ", ".join(f"'{t}'" for t in SUPPORTED_TYPES)
    where_parts = [
        f"[System.TeamProject] = '{project}'",
        f"[System.WorkItemType] IN ({type_clause})",
        "[System.IsDeleted] = False",
    ]
    if assigned_to_email:
        where_parts.append(f"[System.AssignedTo] = '{assigned_to_email}'")

    wiql = {
        "query": (
            "SELECT [System.Id] FROM WorkItems WHERE "
            + " AND ".join(where_parts)
            + " ORDER BY [System.ChangedDate] DESC"
        )
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{base}/_apis/wit/wiql?api-version={API_VERSION}&$top=500",
            headers=headers,
            json=wiql,
        )
        resp.raise_for_status()
        ids = [wi["id"] for wi in resp.json().get("workItems", [])]

    raw = await _fetch_work_items_by_ids(ids, project)
    return [_parse_work_item(item, project) for item in raw]

# ─── Public work item CRUD ────────────────────────────────────────────────────

async def get_configured_projects() -> list[str]:
    return get_settings().azure_devops_projects


async def list_work_items(assigned_to_email: str | None = None) -> list[dict]:
    settings = get_settings()
    projects = settings.azure_devops_projects
    if not projects:
        return []

    results = await asyncio.gather(
        *[_list_work_items_for_project(p, assigned_to_email) for p in projects],
        return_exceptions=True,
    )

    all_items: list[dict] = []
    for project, result in zip(projects, results):
        if isinstance(result, Exception):
            logger.warning("Failed to fetch work items from '%s': %s", project, result)
        else:
            all_items.extend(result)  # type: ignore[arg-type]

    all_items.sort(key=lambda i: i.get("changed_date") or "", reverse=True)
    return all_items


async def get_work_item(item_id: int) -> dict | None:
    settings = get_settings()
    projects = settings.azure_devops_projects
    if not projects:
        return None

    headers = _get_auth_headers()
    for project in projects:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{_project_url(project)}/_apis/wit/workitems/{item_id}",
                headers=headers,
                params={"fields": WORK_ITEM_FIELDS, "api-version": API_VERSION},
            )
            if resp.status_code == 404:
                continue
            resp.raise_for_status()
            return _parse_work_item(resp.json(), project)
    return None


async def create_work_item(
    title: str,
    work_item_type: str,
    project: str,
    description: str | None = None,
    assigned_to_email: str | None = None,
    priority: int | None = None,
    iteration_path: str | None = None,
    parent_id: int | None = None,
) -> dict:
    encoded_type = urllib.parse.quote(work_item_type)
    base = _project_url(project)

    patch: list[dict] = [{"op": "add", "path": "/fields/System.Title", "value": title}]
    if description:
        patch.append({"op": "add", "path": "/fields/System.Description", "value": description})
    if assigned_to_email:
        patch.append({"op": "add", "path": "/fields/System.AssignedTo", "value": assigned_to_email})
    if priority is not None:
        patch.append({"op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": priority})
    if iteration_path:
        patch.append({"op": "add", "path": "/fields/System.IterationPath", "value": iteration_path})
    if parent_id is not None:
        s = get_settings()
        parent_url = f"https://dev.azure.com/{s.azure_devops_org}/{urllib.parse.quote(project)}/_apis/wit/workitems/{parent_id}"
        patch.append({"op": "add", "path": "/relations/-", "value": {"rel": "System.LinkTypes.Hierarchy-Reverse", "url": parent_url}})

    headers = {**_get_auth_headers(), "Content-Type": "application/json-patch+json"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{base}/_apis/wit/workitems/${encoded_type}?api-version={API_VERSION}",
            headers=headers,
            content=json.dumps(patch).encode(),
        )
        resp.raise_for_status()
    return _parse_work_item(resp.json(), project)


async def update_work_item(
    item_id: int,
    title: str | None = None,
    description: str | None = None,
    assigned_to_email: str | None = None,
    state: str | None = None,
    priority: int | None = None,
    clear_assignee: bool = False,
    iteration_path: str | None = None,
) -> dict:
    existing = await get_work_item(item_id)
    if existing is None:
        raise ValueError(f"Work item {item_id} not found")

    project = existing["project"]
    patch: list[dict] = []
    if title is not None:
        patch.append({"op": "replace", "path": "/fields/System.Title", "value": title})
    if description is not None:
        patch.append({"op": "replace", "path": "/fields/System.Description", "value": description})
    if clear_assignee:
        patch.append({"op": "replace", "path": "/fields/System.AssignedTo", "value": ""})
    elif assigned_to_email is not None:
        patch.append({"op": "replace", "path": "/fields/System.AssignedTo", "value": assigned_to_email})
    if state is not None:
        patch.append({"op": "replace", "path": "/fields/System.State", "value": state})
    if iteration_path is not None:
        patch.append({"op": "replace", "path": "/fields/System.IterationPath", "value": iteration_path})
    if priority is not None:
        patch.append({"op": "replace", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": priority})

    if not patch:
        return existing

    headers = {**_get_auth_headers(), "Content-Type": "application/json-patch+json"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.patch(
            f"{_project_url(project)}/_apis/wit/workitems/{item_id}?api-version={API_VERSION}",
            headers=headers,
            content=json.dumps(patch).encode(),
        )
        if not resp.is_success:
            try:
                detail = resp.json().get("message") or resp.text
            except Exception:
                detail = resp.text
            raise httpx.HTTPStatusError(
                f"Azure DevOps {resp.status_code}: {detail}",
                request=resp.request,
                response=resp,
            )
    return _parse_work_item(resp.json(), project)


async def delete_work_item(item_id: int) -> None:
    existing = await get_work_item(item_id)
    if existing is None:
        return

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{_project_url(existing['project'])}/_apis/wit/workitems/{item_id}",
            headers=_get_auth_headers(),
            params={"api-version": API_VERSION},
        )
        if resp.status_code == 404:
            return
        if not resp.is_success:
            try:
                detail = resp.json().get("message") or resp.text
            except Exception:
                detail = resp.text
            raise httpx.HTTPStatusError(
                f"Azure DevOps {resp.status_code}: {detail}",
                request=resp.request,
                response=resp,
            )

async def get_work_item_type_states(project: str, work_item_type: str) -> list[str]:
    headers = _get_auth_headers()
    encoded_type = urllib.parse.quote(work_item_type)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_project_url(project)}/_apis/wit/workitemtypes/{encoded_type}/states",
            headers=headers,
            params={"api-version": API_VERSION},
        )
        resp.raise_for_status()
    return [s["name"] for s in resp.json().get("value", [])]


async def get_all_work_item_states() -> dict[str, list[str]]:
    """Return {work_item_type: [states]} using the first configured project."""
    project = _first_project()
    if not project:
        return {}
    results: dict[str, list[str]] = {}
    for wtype in SUPPORTED_TYPES:
        try:
            results[wtype] = await get_work_item_type_states(project, wtype)
        except Exception as exc:
            logger.warning("Could not fetch states for '%s': %s", wtype, exc)
    return results


# ─── Sprint / Iteration functions ─────────────────────────────────────────────

async def _list_iterations(project: str) -> list[dict]:
    headers = _get_auth_headers()
    team_base = _team_project_url(project)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{team_base}/_apis/work/teamsettings/iterations",
            headers=headers,
            params={"api-version": API_VERSION},
        )
        resp.raise_for_status()

    iterations = []
    for item in resp.json().get("value", []):
        attrs = item.get("attributes", {})
        iterations.append({
            "id": item["id"],
            "name": item["name"],
            "path": item.get("path", ""),
            "start_date": attrs.get("startDate"),
            "finish_date": attrs.get("finishDate"),
            "time_frame": attrs.get("timeFrame", "future"),
            "project": project,
        })
    return iterations


async def _fetch_iteration_story_ids(iteration_id: str, project: str) -> list[int]:
    headers = _get_auth_headers()
    team_base = _team_project_url(project)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{team_base}/_apis/work/teamsettings/iterations/{iteration_id}/workitems",
            headers=headers,
            params={"api-version": API_VERSION},
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()

    relations = resp.json().get("workItemRelations", [])
    return [r["target"]["id"] for r in relations if r.get("target", {}).get("id")]


async def _get_sprint_with_stories(iteration: dict) -> dict:
    project = iteration["project"]
    try:
        ids = await _fetch_iteration_story_ids(iteration["id"], project)
        raw = await _fetch_work_items_by_ids(ids, project)
        stories = [_parse_work_item(item, project) for item in raw]
    except Exception as exc:
        logger.warning("Failed to load stories for sprint '%s' (%s): %s", iteration["name"], project, exc)
        stories = []
    return {**iteration, "stories": stories}


async def _load_project_sprints(project: str) -> list[dict]:
    try:
        return await _list_iterations(project)
    except Exception as exc:
        logger.warning("Failed to load iterations for project '%s': %s", project, exc)
        return []


async def list_sprints_with_stories() -> list[dict]:
    """Return current + past sprints from ALL configured projects, stories fetched in parallel."""
    settings = get_settings()
    projects = settings.azure_devops_projects
    if not projects:
        return []

    # Fetch iteration metadata for all projects in parallel
    all_iters_nested = await asyncio.gather(
        *[_load_project_sprints(p) for p in projects],
        return_exceptions=True,
    )
    all_iterations: list[dict] = []
    for result in all_iters_nested:
        if not isinstance(result, Exception):
            all_iterations.extend(result)  # type: ignore[arg-type]

    # current first, then future (upcoming) sorted by start date, then past by most recent
    current = [i for i in all_iterations if i["time_frame"] == "current"]
    future = sorted(
        [i for i in all_iterations if i["time_frame"] == "future"],
        key=lambda i: i.get("start_date") or "",
    )
    past = sorted(
        [i for i in all_iterations if i["time_frame"] == "past"],
        key=lambda i: i.get("finish_date") or "",
        reverse=True,
    )
    ordered = current + future + past

    # Fetch stories for all sprints in parallel
    results = await asyncio.gather(
        *[_get_sprint_with_stories(it) for it in ordered],
        return_exceptions=True,
    )

    sprints = []
    for it, result in zip(ordered, results):
        if isinstance(result, Exception):
            logger.warning("Sprint '%s' (%s) error: %s", it["name"], it["project"], result)
            sprints.append({**it, "stories": []})
        else:
            sprints.append(result)

    return sprints
