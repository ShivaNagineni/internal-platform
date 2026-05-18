from __future__ import annotations
import logging
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_BASE = "https://api.github.com"


def _resolve_repo(github_repo: str | None) -> str | None:
    if github_repo:
        return github_repo
    settings = get_settings()
    repos = settings.get_github_repos()
    return repos[0] if repos else None


async def create_dev_to_qa_pr(
    version: str,
    title: str,
    description: str | None = None,
    github_repo: str | None = None,
    dev_branch: str | None = None,
    qa_branch: str | None = None,
) -> dict[str, int | str] | None:
    """Create a PR from dev → qa on the given repo. Returns {pr_number, url} or None."""
    settings = get_settings()
    repo = _resolve_repo(github_repo)
    if not settings.github_token or not repo:
        logger.warning("GitHub token or repo not configured — skipping dev→qa PR creation")
        return None

    owner = repo.split("/")[0]
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    pr_title = f"v{version} - {title}"
    body = description or f"Release `v{version}`: {title}"

    async with httpx.AsyncClient(timeout=15) as client:
        branch_resp = await client.get(f"{_BASE}/repos/{repo}/branches", headers=headers)
        if branch_resp.status_code != 200:
            logger.error("Failed to list branches for %s: %s", repo, branch_resp.text)
            return None

        branches = [b["name"] for b in branch_resp.json()]

        if dev_branch:
            resolved_dev = next((b for b in branches if b == dev_branch), None) \
                or next((b for b in branches if b.lower() == dev_branch.lower()), None)
        else:
            resolved_dev = next((b for b in branches if b.lower() in ("development", "dev")), None)

        if qa_branch:
            resolved_qa = next((b for b in branches if b == qa_branch), None) \
                or next((b for b in branches if b.lower() == qa_branch.lower()), None)
        else:
            resolved_qa = next((b for b in branches if b.lower() == "qa"), None)

        if not resolved_dev or not resolved_qa:
            logger.warning("dev or qa branch not found in %s (branches: %s)", repo, branches)
            return None

        check_resp = await client.get(
            f"{_BASE}/repos/{repo}/pulls",
            headers=headers,
            params={"state": "open", "head": f"{owner}:{resolved_dev}", "base": resolved_qa},
        )
        if check_resp.status_code == 200 and check_resp.json():
            existing = check_resp.json()[0]
            logger.info("dev→qa PR already exists for %s: %s", repo, existing["html_url"])
            return {"pr_number": existing["number"], "url": existing["html_url"]}

        resp = await client.post(
            f"{_BASE}/repos/{repo}/pulls",
            headers=headers,
            json={"title": pr_title, "head": resolved_dev, "base": resolved_qa, "body": body},
        )
        if resp.status_code == 201:
            data = resp.json()
            logger.info("Created dev→qa PR for %s: %s", repo, data["html_url"])
            return {"pr_number": data["number"], "url": data["html_url"]}
        else:
            logger.error("Failed to create dev→qa PR for %s: HTTP %s — %s", repo, resp.status_code, resp.text)
            return None


async def create_qa_to_main_pr(
    version: str,
    title: str,
    github_repo: str | None = None,
    qa_branch: str | None = None,
    main_branch: str | None = None,
) -> list[dict[str, int | str]]:
    """Create a PR from qa → main. Returns list of {pr_number, url, repo} dicts."""
    settings = get_settings()
    if not settings.github_token:
        logger.warning("GitHub token not configured — skipping PR creation")
        return []

    if github_repo:
        repos = [github_repo]
    else:
        repos = settings.get_github_repos()

    if not repos:
        logger.warning("No GitHub repos configured — skipping PR creation")
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

            branch_resp = await client.get(
                f"{_BASE}/repos/{repo}/branches",
                headers=headers,
            )
            if branch_resp.status_code != 200:
                logger.error("Failed to list branches for %s: %s %s", repo, branch_resp.status_code, branch_resp.text)
                continue

            branches = [b["name"] for b in branch_resp.json()]

            if qa_branch:
                resolved_qa = next((b for b in branches if b == qa_branch), None) \
                    or next((b for b in branches if b.lower() == qa_branch.lower()), None)
            else:
                resolved_qa = next((b for b in branches if b.lower() == "qa"), None)

            if main_branch:
                resolved_main = next((b for b in branches if b == main_branch), None) \
                    or next((b for b in branches if b.lower() == main_branch.lower()), None) \
                    or main_branch  # pass configured value through; GitHub will reject if wrong
            else:
                resolved_main = next((b for b in branches if b.lower() in ("main", "master")), None) \
                    or "main"

            if not resolved_qa:
                logger.warning("No 'qa' branch found in %s (branches: %s) — skipping", repo, branches)
                continue

            check_resp = await client.get(
                f"{_BASE}/repos/{repo}/pulls",
                headers=headers,
                params={"state": "open", "head": f"{owner}:{resolved_qa}", "base": resolved_main},
            )
            if check_resp.status_code == 200 and check_resp.json():
                existing = check_resp.json()[0]
                logger.info("PR already exists for %s: %s", repo, existing["html_url"])
                created.append({"pr_number": existing["number"], "url": existing["html_url"], "repo": repo})
                continue

            resp = await client.post(
                f"{_BASE}/repos/{repo}/pulls",
                headers=headers,
                json={
                    "title": pr_title,
                    "head": resolved_qa,
                    "base": resolved_main,
                    "body": f"Automated release PR for `v{version}`.\n\nCreated by Internal Platform when release reached STAGING.",
                },
            )
            if resp.status_code == 201:
                data = resp.json()
                logger.info("Created PR for %s: %s", repo, data["html_url"])
                created.append({"pr_number": data["number"], "url": data["html_url"], "repo": repo})
            else:
                logger.error(
                    "Failed to create PR for %s: HTTP %s — %s",
                    repo, resp.status_code, resp.text,
                )

    return created


async def merge_pr(pr_number: int, github_repo: str | None = None) -> bool:
    """Merge a PR via the GitHub API. Returns True on success."""
    settings = get_settings()
    repo = _resolve_repo(github_repo)
    if not settings.github_token or not repo:
        logger.warning("GitHub token or repo not configured — cannot merge PR")
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


async def has_commits_ahead(
    github_repo: str,
    dev_branch: str,
    qa_branch: str,
) -> tuple[bool, str]:
    """Return (True, "") if dev_branch has commits ahead of qa_branch, else (False, reason)."""
    settings = get_settings()
    if not settings.github_token:
        return True, ""  # can't verify, allow through

    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        br_resp = await client.get(
            f"{_BASE}/repos/{github_repo}/branches",
            headers=headers,
            params={"per_page": 100},
        )
        branches = [b["name"] for b in br_resp.json()] if br_resp.status_code == 200 else []

        resolved_dev = (
            next((b for b in branches if b == dev_branch), None)
            or next((b for b in branches if b.lower() == dev_branch.lower()), dev_branch)
        )
        resolved_qa = (
            next((b for b in branches if b == qa_branch), None)
            or next((b for b in branches if b.lower() == qa_branch.lower()), qa_branch)
        )

        resp = await client.get(
            f"{_BASE}/repos/{github_repo}/compare/{resolved_qa}...{resolved_dev}",
            headers=headers,
        )
        if resp.status_code == 404:
            return False, (
                f"Branch not found in {github_repo} — check branch names in repository settings."
            )
        if resp.status_code != 200:
            return True, ""  # can't determine, allow through

        ahead_by = resp.json().get("ahead_by", 0)
        if ahead_by == 0:
            return False, (
                f"'{resolved_dev}' has no new commits compared to '{resolved_qa}' "
                f"in {github_repo}. Nothing to release."
            )
        return True, ""


async def get_pr_status(pr_number: int, github_repo: str | None = None) -> dict | None:
    """Fetch the current status of a PR. Returns the PR JSON or None on failure."""
    settings = get_settings()
    repo = _resolve_repo(github_repo)
    if not settings.github_token or not repo:
        logger.warning("GitHub token or repo not configured — cannot fetch PR status")
        return None

    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{_BASE}/repos/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.error("Failed to fetch PR #%s in %s: HTTP %s — %s", pr_number, repo, resp.status_code, resp.text)
        return None
