from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks

from app.core.auth import get_current_user
from app.models.idea import Idea, IdeaStatus, IdeaCategory
from app.models.user import User, UserRole
from app.schemas.idea import IdeaAuthorOut, IdeaCreate, IdeaOut, IdeaUpdate
from app.services.idea_service import has_voted, toggle_vote
from app.services.state_machine import IDEA_TRANSITIONS, validate_transition

router = APIRouter(prefix="/ideas", tags=["ideas"])


async def _idea_to_out(idea: Idea, current_user_id: uuid.UUID) -> IdeaOut:
    author = await User.get(idea.author_id)
    voted = await has_voted(idea.id, current_user_id)
    return IdeaOut(
        id=idea.id,
        title=idea.title,
        description=idea.description,
        author_id=idea.author_id,
        author=IdeaAuthorOut(
            id=author.id,
            azure_oid=author.azure_oid,
            display_name=author.display_name,
            email=author.email,
            department=author.department,
        ),
        status=idea.status,
        category=idea.category,
        upvote_count=idea.upvote_count,
        voted_by_me=voted,
        created_at=idea.created_at,
        updated_at=idea.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /ideas/
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[IdeaOut])
async def list_ideas(
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = Query(None),
    current_user: User = Depends(get_current_user),
):
    query = Idea.find()
    if status_filter:
        try:
            query = query.find(Idea.status == IdeaStatus(status_filter.upper()))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status: {status_filter}",
            )
    if category:
        try:
            query = query.find(Idea.category == IdeaCategory(category.upper()))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid category: {category}",
            )

    ideas = await query.sort(-Idea.created_at).to_list()
    return [await _idea_to_out(idea, current_user.id) for idea in ideas]


# ---------------------------------------------------------------------------
# POST /ideas/
# ---------------------------------------------------------------------------
@router.post("/", response_model=IdeaOut, status_code=status.HTTP_201_CREATED)
async def create_idea(
    payload: IdeaCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    idea = Idea(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        author_id=current_user.id,
        status=IdeaStatus.SUBMITTED,
        upvote_count=0,
    )
    await idea.insert()
    from app.services.notification_service import notify_idea_status_change
    background_tasks.add_task(notify_idea_status_change, str(idea.id))
    return await _idea_to_out(idea, current_user.id)


# ---------------------------------------------------------------------------
# GET /ideas/{id}
# ---------------------------------------------------------------------------
@router.get("/{idea_id}", response_model=IdeaOut)
async def get_idea(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    idea = await Idea.get(idea_id)
    if idea is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    return await _idea_to_out(idea, current_user.id)


# ---------------------------------------------------------------------------
# PATCH /ideas/{id}
# ---------------------------------------------------------------------------
@router.patch("/{idea_id}", response_model=IdeaOut)
async def update_idea(
    idea_id: uuid.UUID,
    payload: IdeaUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    idea = await Idea.get(idea_id)
    if idea is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    is_manager_or_above = current_user.role in {UserRole.MANAGER, UserRole.ADMIN}
    is_author = idea.author_id == current_user.id

    if payload.title is not None or payload.description is not None or payload.category is not None:
        if not is_author:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the author can edit idea content",
            )
        if idea.status != IdeaStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Content can only be edited while idea is SUBMITTED",
            )
        if payload.title is not None:
            idea.title = payload.title
        if payload.description is not None:
            idea.description = payload.description
        if payload.category is not None:
            idea.category = payload.category

    status_changed = False
    if payload.status is not None:
        if not is_manager_or_above:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers can change idea status",
            )
        validate_transition(idea.status, payload.status, IDEA_TRANSITIONS)
        idea.status = payload.status
        idea.updated_at = datetime.now(UTC)
        status_changed = True

    await idea.save()

    if status_changed:
        from app.services.notification_service import notify_idea_status_change
        background_tasks.add_task(notify_idea_status_change, str(idea.id))

    return await _idea_to_out(idea, current_user.id)


# ---------------------------------------------------------------------------
# POST /ideas/{id}/vote
# ---------------------------------------------------------------------------
@router.post("/{idea_id}/vote", response_model=IdeaOut)
async def vote_idea(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    idea = await Idea.get(idea_id)
    if idea is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    await toggle_vote(idea_id, current_user.id)

    idea = await Idea.get(idea_id)
    return await _idea_to_out(idea, current_user.id)


# ---------------------------------------------------------------------------
# DELETE /ideas/{id}
# ---------------------------------------------------------------------------
@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_idea(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    idea = await Idea.get(idea_id)
    if idea is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    is_admin = current_user.role == UserRole.ADMIN
    is_author = idea.author_id == current_user.id

    if not is_admin and not is_author:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if is_author and not is_admin and idea.status != IdeaStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Authors can only delete SUBMITTED ideas",
        )

    await idea.delete()
