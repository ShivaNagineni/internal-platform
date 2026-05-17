from __future__ import annotations
import logging
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_BASE = "https://api.github.com"


async def create_dev_to_qa_pr(version: str, title: str, description: str | None = None) -> dict[str, int | str] | None:
    """Create a PR from Development → Qa on the first configured repo. Returns {pr_number, url} or None."""
    settings = get_settings()
    repos = settings.get_github_repos()
    if not settings.github_token or not repos:
        logger.warning("GitHub token or repos not configured — skipping dev→qa PR creation")
        return None

    repo = repos[0]
    owner = repo.split("/")[0]
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    pr_title = f"v{version} - {title}"
    body = description or f"Release `v{version}`: {title}"

    async with httpx.AsyncClient(timeout=15) as client:
        # Detect actual branch names (case-insensitive)
        branch_resp = await client.get(f"{_BASE}/repos/{repo}/branches", headers=headers)
        if branch_resp.status_code != 200:
            logger.error("Failed to list branches for %s: %s", repo, branch_resp.text)
            return None

        branches = [b["name"] for b in branch_resp.json()]
        dev_branch = next((b for b in branches if b.lower() in ("development", "dev")), None)
        qa_branch = next((b for b in branches if b.lower() == "qa"), None)

        if not dev_branch or not qa_branch:
            logger.warning("dev or qa branch not found in %s (branches: %s)", repo, branches)
            return None

        # Return existing open PR if one already exists
        check_resp = await client.get(
            f"{_BASE}/repos/{repo}/pulls",
            headers=headers,
            params={"state": "open", "head": f"{owner}:{dev_branch}", "base": qa_branch},
        )
        if check_resp.status_code == 200 and check_resp.json():
            existing = check_resp.json()[0]
            logger.info("dev→qa PR already exists for %s: %s", repo, existing["html_url"])
            return {"pr_number": existing["number"], "url": existing["html_url"]}

        resp = await client.post(
            f"{_BASE}/repos/{repo}/pulls",
            headers=headers,
            json={"title": pr_title, "head": dev_branch, "base": qa_branch, "body": body},
        )
        if resp.status_code == 201:
            data = resp.json()
            logger.info("Created dev→qa PR for %s: %s", repo, data["html_url"])
            return {"pr_number": data["number"], "url": data["html_url"]}
        else:
            logger.error("Failed to create dev→qa PR for %s: HTTP %s — %s", repo, resp.status_code, resp.text)
            return None


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


async def merge_pr(repo: str, pr_number: int) -> bool:
    """Merge a PR via the GitHub API. Returns True on success."""
    settings = get_settings()
    if not settings.github_token:
        logger.warning("GitHub token not configured — cannot merge PR")
        return False

    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.put(
            f"{_BASE}/repos/{repo}/pulls/{pr_number}/merge",
            headers=headers,
            json={"merge_method": "merge"},
        )
        if resp.status_code == 200:
            logger.info("Merged PR #%s in %s", pr_number, repo)
            return True
        else:
            logger.error("Failed to merge PR #%s in %s: HTTP %s — %s", pr_number, repo, resp.status_code, resp.text)
            return False
