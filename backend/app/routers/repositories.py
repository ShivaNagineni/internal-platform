from __future__ import annotations

import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.models.user import User, UserRole
from app.models.repository import Repository
from app.models.release import Release
from app.schemas.repository import RepositoryCreate, RepositoryOut, RepositoryUpdate

router = APIRouter(prefix="/repositories", tags=["repositories"])


def _require_admin_or_owner(current_user: User) -> None:
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Owner role required",
        )


@router.get("/", response_model=list[RepositoryOut])
async def list_repositories(current_user: User = Depends(get_current_user)):
    repos = await Repository.find().to_list()
    repos.sort(key=lambda r: r.name)
    return repos


@router.post("/", response_model=RepositoryOut, status_code=status.HTTP_201_CREATED)
async def create_repository(
    body: RepositoryCreate,
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_owner(current_user)

    existing = await Repository.find_one(Repository.github_repo == body.github_repo)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A repository with this github_repo already exists",
        )

    repo = Repository(
        name=body.name,
        github_repo=body.github_repo,
        dev_branch=body.dev_branch,
        qa_branch=body.qa_branch,
        main_branch=body.main_branch,
    )
    await repo.insert()
    return repo


@router.patch("/{repo_id}", response_model=RepositoryOut)
async def update_repository(
    repo_id: uuid.UUID,
    body: RepositoryUpdate,
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_owner(current_user)

    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    if body.github_repo is not None and body.github_repo != repo.github_repo:
        existing = await Repository.find_one(Repository.github_repo == body.github_repo)
        if existing and existing.id != repo.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A repository with this github_repo already exists",
            )
        repo.github_repo = body.github_repo

    if body.name is not None:
        repo.name = body.name
    if body.dev_branch is not None:
        repo.dev_branch = body.dev_branch
    if body.qa_branch is not None:
        repo.qa_branch = body.qa_branch
    if body.main_branch is not None:
        repo.main_branch = body.main_branch

    await repo.save()
    return repo


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_owner(current_user)

    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    referenced = await Release.find_one(Release.repository_id == repo.id)
    if referenced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a repository that has releases referencing it",
        )

    await repo.delete()


@router.post("/sync-from-github", response_model=list[RepositoryOut])
async def sync_repos_from_github(current_user: User = Depends(get_current_user)):
    """Fetch all repos accessible to the configured GitHub token and import new ones."""
    _require_admin_or_owner(current_user)

    settings = get_settings()
    if not settings.github_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub token not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params={"per_page": 100, "type": "all", "sort": "full_name"},
            timeout=15,
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API returned {resp.status_code}: {resp.text[:200]}",
        )

    gh_repos = resp.json()
    created: list[Repository] = []

    for gh in gh_repos:
        full_name: str = gh["full_name"]
        existing = await Repository.find_one(Repository.github_repo == full_name)
        if existing:
            continue
        repo = Repository(
            name=gh["name"],
            github_repo=full_name,
            dev_branch="Development",
            qa_branch="Qa",
            main_branch=gh.get("default_branch", "main"),
        )
        await repo.insert()
        created.append(repo)

    return created
