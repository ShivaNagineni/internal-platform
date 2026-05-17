from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks

from app.core.auth import get_current_user
from app.core.security import require_admin, require_manager
from app.models.release import Release, ReleaseStatus, ReleaseStatusEntry
from app.models.user import User, UserRole
from app.schemas.release import ReleaseCreate, ReleaseOut, ReleaseOwnerOut, ReleaseUpdate
from app.services.release_service import check_version_unique, validate_version
from app.services.state_machine import RELEASE_TRANSITIONS, validate_transition

router = APIRouter(prefix="/releases", tags=["releases"])


async def _release_to_out(release: Release) -> ReleaseOut:
    owner = await User.get(release.owner_id) if release.owner_id else None
    hist = release.status_history
    if not hist:
        hist = [ReleaseStatusEntry(status=release.status, changed_at=release.created_at)]
    return ReleaseOut(
        id=release.id,
        title=release.title,
        version=release.version,
        description=release.description,
        release_date=release.release_date,
        status=release.status,
        status_history=hist,
        owner_id=release.owner_id,
        owner=ReleaseOwnerOut(
            id=owner.id,
            display_name=owner.display_name,
            email=owner.email,
        ) if owner else None,
        changelog=release.changelog,
        created_at=release.created_at,
        updated_at=release.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /releases/
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[ReleaseOut])
async def list_releases(
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
):
    query = Release.find()
    if status_filter:
        try:
            query = query.find(Release.status == ReleaseStatus(status_filter.upper()))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status: {status_filter}",
            )

    releases = await query.sort(+Release.release_date, -Release.created_at).to_list()
    return [await _release_to_out(r) for r in releases]


# ---------------------------------------------------------------------------
# POST /releases/
# ---------------------------------------------------------------------------
@router.post("/", response_model=ReleaseOut, status_code=status.HTTP_201_CREATED)
async def create_release(
    payload: ReleaseCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_manager),
):
    validate_version(payload.version)
    await check_version_unique(payload.version)

    now = datetime.now(UTC)
    release = Release(
        title=payload.title,
        version=payload.version,
        description=payload.description,
        release_date=payload.release_date,
        owner_id=current_user.id,
        status=ReleaseStatus.PLANNED,
        status_history=[ReleaseStatusEntry(status=ReleaseStatus.PLANNED, changed_at=now)],
    )
    await release.insert()

    from app.services.notification_service import notify_release_status_change
    background_tasks.add_task(notify_release_status_change, str(release.id))

    return await _release_to_out(release)


# ---------------------------------------------------------------------------
# GET /releases/{id}
# ---------------------------------------------------------------------------
@router.get("/{release_id}", response_model=ReleaseOut)
async def get_release(
    release_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    release = await Release.get(release_id)
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release not found")
    return await _release_to_out(release)


# ---------------------------------------------------------------------------
# PATCH /releases/{id}
# ---------------------------------------------------------------------------
@router.patch("/{release_id}", response_model=ReleaseOut)
async def update_release(
    release_id: uuid.UUID,
    payload: ReleaseUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_manager),
):
    release = await Release.get(release_id)
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release not found")

    is_approver = current_user.role in {UserRole.MANAGER, UserRole.ADMIN}
    is_owner = release.owner_id == current_user.id

    if not is_approver and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Managers, Admins, or Owners can update this release",
        )

    if payload.title is not None:
        release.title = payload.title
    if payload.description is not None:
        release.description = payload.description
    if payload.release_date is not None:
        release.release_date = payload.release_date
    if payload.changelog is not None:
        release.changelog = payload.changelog

    status_changed = False
    if payload.status is not None and payload.status != release.status:
        validate_transition(release.status, payload.status, RELEASE_TRANSITIONS)
        release.status = payload.status
        now = datetime.now(UTC)
        release.updated_at = now
        if not release.status_history:
            release.status_history = [ReleaseStatusEntry(status=ReleaseStatus.PLANNED, changed_at=release.created_at)]
        release.status_history.append(ReleaseStatusEntry(status=payload.status, changed_at=now))
        status_changed = True

    await release.save()

    if status_changed:
        from app.services.notification_service import notify_release_status_change
        background_tasks.add_task(notify_release_status_change, str(release.id))

    return await _release_to_out(release)


# ---------------------------------------------------------------------------
# DELETE /releases/{id}
# ---------------------------------------------------------------------------
@router.delete("/{release_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_release(
    release_id: uuid.UUID,
    current_user: User = Depends(require_admin),
):
    release = await Release.get(release_id)
    if release is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release not found")

    await release.delete()
