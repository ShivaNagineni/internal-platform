from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserRoleUpdate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


async def get_user_points(user_id: uuid.UUID) -> int:
    from app.models.idea import Idea, IdeaStatus
    ideas = await Idea.find(Idea.author_id == user_id).to_list()
    total = 0
    for idea in ideas:
        total += 5  # Submission
        total += idea.upvote_count * 10  # Team Endorsement
        if idea.status in {IdeaStatus.UNDER_REVIEW, IdeaStatus.APPROVED, IdeaStatus.IMPLEMENTED}:
            total += 20  # Merit Selection
        if idea.status == IdeaStatus.IMPLEMENTED:
            total += 50  # Execution Milestone
    return total


async def _user_to_out(user: User) -> UserOut:
    points = await get_user_points(user.id)
    return UserOut(
        id=user.id,
        azure_oid=user.azure_oid,
        email=user.email,
        display_name=user.display_name,
        department=user.department,
        role=user.role,
        theme=user.theme,
        is_active=user.is_active,
        points=points,
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return await _user_to_out(current_user)


@router.get("/", response_model=list[UserOut])
async def list_users(
    active_only: bool = True,
    sort_by: str = Query("name"),
    current_user: User = Depends(get_current_user),
):
    query = User.find(User.is_active == True) if active_only else User.find()  # noqa: E712
    users = await query.to_list()
    out = [await _user_to_out(u) for u in users]
    if sort_by == "points":
        out.sort(key=lambda x: x.points, reverse=True)
    else:
        out.sort(key=lambda x: x.display_name)
    return out


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await _user_to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER} and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.department is not None:
        user.department = body.department
    if body.theme is not None:
        user.theme = body.theme
    await user.save()
    return await _user_to_out(user)


@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID,
    body: UserRoleUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or Manager only")
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await user.save()
    return await _user_to_out(user)



@router.patch("/{user_id}/toggle-active", response_model=UserOut)
async def toggle_user_active(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or Manager only")
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = not user.is_active
    await user.save()
    return await _user_to_out(user)
