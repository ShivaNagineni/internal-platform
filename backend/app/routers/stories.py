from __future__ import annotations

import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.security import require_manager
from app.models.user import User, UserRole
from app.schemas.story import (
    SprintOut,
    SprintStatsOut,
    StoryAssignedToOut,
    StoryCreate,
    StoryOut,
    StorySprintUpdate,
    StoryStateUpdate,
    StoryUpdate,
    StoryUserOut,
)
from app.services import azure_devops_service as ado

router = APIRouter(prefix="/stories", tags=["stories"])

DONE_STATES = {"closed", "resolved", "done", "completed"}

# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _resolve_platform_user(email: str | None) -> StoryUserOut | None:
    if not email:
        return None
    user = await User.find_one(User.email == email)
    if not user:
        user = await User.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if user:
        return StoryUserOut(id=str(user.id), display_name=user.display_name, email=user.email)
    return None


async def _enrich(item: dict) -> StoryOut:
    raw_assigned = item.get("assigned_to")
    assigned_to_out = (
        StoryAssignedToOut(
            display_name=raw_assigned["display_name"],
            unique_name=raw_assigned["unique_name"],
        )
        if raw_assigned
        else None
    )
    platform_user = await _resolve_platform_user(raw_assigned["unique_name"] if raw_assigned else None)
    return StoryOut(
        id=item["id"],
        project=item.get("project", ""),
        title=item["title"],
        description=item.get("description"),
        work_item_type=item["work_item_type"],
        state=item["state"],
        assigned_to=assigned_to_out,
        assigned_to_platform_user=platform_user,
        priority=item.get("priority"),
        created_date=item.get("created_date"),
        changed_date=item.get("changed_date"),
        url=item.get("url"),
    )


def _sprint_stats(stories: list[dict]) -> SprintStatsOut:
    by_state: dict[str, int] = {}
    by_type: dict[str, int] = {}
    done = 0
    for s in stories:
        state = s.get("state") or "Unknown"
        wtype = s.get("work_item_type") or "Unknown"
        by_state[state] = by_state.get(state, 0) + 1
        by_type[wtype] = by_type.get(wtype, 0) + 1
        if state.lower() in DONE_STATES:
            done += 1
    return SprintStatsOut(total=len(stories), by_state=by_state, by_type=by_type, done_count=done)

# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=list[str])
async def list_projects(current_user: User = Depends(get_current_user)):
    return await ado.get_configured_projects()


@router.get("/states", response_model=dict[str, list[str]])
async def list_states(current_user: User = Depends(get_current_user)):
    try:
        return await ado.get_all_work_item_states()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.get("/sprints", response_model=list[SprintOut])
async def list_sprints(current_user: User = Depends(get_current_user)):
    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}

    try:
        sprints = await ado.list_sprints_with_stories()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Azure DevOps unavailable: {exc}",
        )

    result = []
    for sprint in sprints:
        raw_stories = sprint.get("stories", [])

        # Employees only see their own stories within each sprint
        if not is_manager_plus:
            raw_stories = [
                s for s in raw_stories
                if (s.get("assigned_to") or {}).get("unique_name", "").lower()
                == current_user.email.lower()
            ]
            # Only hide past sprints that have no employee stories;
            # always show current + future so employees can move stories into them
            if not raw_stories and sprint.get("time_frame") == "past":
                continue

        stories_out = [await _enrich(s) for s in raw_stories]
        result.append(
            SprintOut(
                id=sprint["id"],
                project=sprint.get("project", ""),
                name=sprint["name"],
                path=sprint.get("path", ""),
                start_date=sprint.get("start_date"),
                finish_date=sprint.get("finish_date"),
                time_frame=sprint["time_frame"],
                stories=stories_out,
                stats=_sprint_stats(raw_stories),
            )
        )
    return result


@router.get("/", response_model=list[StoryOut])
async def list_stories(current_user: User = Depends(get_current_user)):
    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}
    email_filter = None if is_manager_plus else current_user.email

    try:
        items = await ado.list_work_items(assigned_to_email=email_filter)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Azure DevOps unavailable: {exc}",
        )

    return [await _enrich(item) for item in items]


@router.get("/{item_id}", response_model=StoryOut)
async def get_story(item_id: int, current_user: User = Depends(get_current_user)):
    try:
        item = await ado.get_work_item(item_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")

    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}
    if not is_manager_plus:
        assigned = item.get("assigned_to")
        if not assigned or assigned.get("unique_name", "").lower() != current_user.email.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return await _enrich(item)


@router.patch("/{item_id}/state", response_model=StoryOut)
async def update_story_state(
    item_id: int,
    payload: StoryStateUpdate,
    current_user: User = Depends(get_current_user),
):
    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}

    try:
        item = await ado.get_work_item(item_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")

    if not is_manager_plus:
        assigned = item.get("assigned_to")
        if not assigned or assigned.get("unique_name", "").lower() != current_user.email.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only change state of stories assigned to you")

    try:
        updated = await ado.update_work_item(item_id=item_id, state=payload.state)
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if 400 <= code < 500:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    return await _enrich(updated)


@router.patch("/{item_id}/sprint", response_model=StoryOut)
async def move_story_sprint(
    item_id: int,
    payload: StorySprintUpdate,
    current_user: User = Depends(get_current_user),
):
    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}

    try:
        item = await ado.get_work_item(item_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")

    if not is_manager_plus:
        assigned = item.get("assigned_to")
        if not assigned or assigned.get("unique_name", "").lower() != current_user.email.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only move stories assigned to you")

    try:
        updated = await ado.update_work_item(item_id=item_id, iteration_path=payload.sprint_path)
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if 400 <= code < 500:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return await _enrich(updated)


@router.post("/", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
async def create_story(payload: StoryCreate, current_user: User = Depends(get_current_user)):
    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}
    projects = await ado.get_configured_projects()
    if payload.project not in projects:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Project '{payload.project}' is not configured.",
        )
    # Employees can only create stories assigned to themselves
    assigned_to_email = payload.assigned_to_email if is_manager_plus else current_user.email
    try:
        item = await ado.create_work_item(
            title=payload.title,
            work_item_type=payload.work_item_type,
            project=payload.project,
            description=payload.description,
            assigned_to_email=assigned_to_email,
            priority=payload.priority,
            iteration_path=payload.sprint_path,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    return await _enrich(item)


@router.patch("/{item_id}", response_model=StoryOut)
async def update_story(item_id: int, payload: StoryUpdate, current_user: User = Depends(require_manager)):
    try:
        item = await ado.update_work_item(
            item_id=item_id,
            title=payload.title,
            description=payload.description,
            assigned_to_email=payload.assigned_to_email,
            state=payload.state,
            priority=payload.priority,
            clear_assignee=payload.clear_assignee,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    return await _enrich(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(item_id: int, current_user: User = Depends(get_current_user)):
    is_manager_plus = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}

    if not is_manager_plus:
        try:
            item = await ado.get_work_item(item_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")
        assigned = item.get("assigned_to")
        if not assigned or assigned.get("unique_name", "").lower() != current_user.email.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete stories assigned to you")

    try:
        await ado.delete_work_item(item_id)
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if 400 <= code < 500:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
