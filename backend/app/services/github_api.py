from __future__ import annotations
import logging
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_BASE = "https://api.github.com"


async def create_qa_to_main_pr(version: str, title: str) -> list[str]:
    """Create a PR from Qa → main on every configured repo. Returns list of PR URLs created."""
    settings = get_settings()
    repos = settings.get_github_repos()
    if not settings.github_token or not repos:
        logger.warning("GitHub token or repos not configured — skipping PR creation")
        return []

    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    pr_title = f"v{version} - {title}"
    created = []

    async with httpx.AsyncClient(timeout=15) as client:
        for repo in repos:
            owner = repo.split("/")[0]

            # Detect the actual case of the Qa branch
            branch_resp = await client.get(
                f"{_BASE}/repos/{repo}/branches",
                headers=headers,
            )
            if branch_resp.status_code != 200:
                logger.error("Failed to list branches for %s: %s %s", repo, branch_resp.status_code, branch_resp.text)
                continue

            branches = [b["name"] for b in branch_resp.json()]
            qa_branch = next((b for b in branches if b.lower() == "qa"), None)
            if not qa_branch:
                logger.warning("No 'qa' branch found in %s (branches: %s) — skipping", repo, branches)
                continue

            # Check if a PR from qa → main already exists
            check_resp = await client.get(
                f"{_BASE}/repos/{repo}/pulls",
                headers=headers,
                params={"state": "open", "head": f"{owner}:{qa_branch}", "base": "main"},
            )
            if check_resp.status_code == 200 and check_resp.json():
                existing = check_resp.json()[0]
                logger.info("PR already exists for %s: %s", repo, existing["html_url"])
                created.append(existing["html_url"])
                continue

            resp = await client.post(
                f"{_BASE}/repos/{repo}/pulls",
                headers=headers,
                json={
                    "title": pr_title,
                    "head": qa_branch,
                    "base": "main",
                    "body": f"Automated release PR for `v{version}`.\n\nCreated by Internal Platform when release reached STAGING.",
                },
            )
            if resp.status_code == 201:
                url = resp.json()["html_url"]
                logger.info("Created PR for %s: %s", repo, url)
                created.append(url)
            else:
                logger.error(
                    "Failed to create PR for %s: HTTP %s — %s",
                    repo, resp.status_code, resp.text,
                )

    return created
