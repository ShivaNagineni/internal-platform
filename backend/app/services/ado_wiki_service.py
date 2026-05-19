from __future__ import annotations

import base64
import urllib.parse

import httpx

from app.core.config import get_settings

API_VERSION = "7.1"


def _auth_headers() -> dict[str, str]:
    s = get_settings()
    encoded = base64.b64encode(f":{s.azure_devops_pat}".encode()).decode()
    return {"Authorization": f"Basic {encoded}"}


def _base(project: str) -> str:
    s = get_settings()
    return f"https://dev.azure.com/{s.azure_devops_org}/{urllib.parse.quote(project)}"


# ─── Page tree flattening ─────────────────────────────────────────────────────

def _flatten(page: dict, project: str, wiki_id: str, wiki_name: str) -> list[dict]:
    path = page.get("path", "/")
    results: list[dict] = []
    if path != "/":
        title = path.rsplit("/", 1)[-1] or path
        results.append({
            "path": path,
            "title": title,
            "project": project,
            "wiki_id": wiki_id,
            "wiki_name": wiki_name,
            "has_sub_pages": bool(page.get("subPages")),
        })
    for sub in page.get("subPages", []):
        results.extend(_flatten(sub, project, wiki_id, wiki_name))
    return results


# ─── Public functions ─────────────────────────────────────────────────────────

async def list_wikis_for_project(project: str) -> list[dict]:
    url = f"{_base(project)}/_apis/wiki/wikis?api-version={API_VERSION}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers=_auth_headers())
        r.raise_for_status()
    return r.json().get("value", [])


async def list_all_ado_wiki_pages() -> list[dict]:
    """Return flat list of all wiki pages from all configured projects."""
    s = get_settings()
    all_pages: list[dict] = []

    for project in s.azure_devops_projects:
        try:
            wikis = await list_wikis_for_project(project)
        except Exception:
            continue

        for wiki in wikis:
            wiki_id = wiki["id"]
            wiki_name = wiki["name"]
            url = (
                f"{_base(project)}/_apis/wiki/wikis/{wiki_id}/pages"
                f"?recursionLevel=Full&includeContent=False&api-version={API_VERSION}"
            )
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.get(url, headers=_auth_headers())
                    r.raise_for_status()
                all_pages.extend(_flatten(r.json(), project, wiki_id, wiki_name))
            except Exception:
                continue

    return all_pages


async def get_ado_wiki_page_content(project: str, wiki_id: str, path: str) -> str:
    """Return markdown content of a specific wiki page."""
    encoded_path = urllib.parse.quote(path)
    url = (
        f"{_base(project)}/_apis/wiki/wikis/{wiki_id}/pages"
        f"?path={encoded_path}&includeContent=True&api-version={API_VERSION}"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers=_auth_headers())
        r.raise_for_status()
    return r.json().get("content", "")
