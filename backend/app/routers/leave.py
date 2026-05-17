from __future__ import annotations

import uuid
from datetime import UTC, datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks

from app.core.auth import get_current_user
from app.models.leave import Leave, LeaveStatus
from app.models.user import User, UserRole
from app.schemas.leave import LeaveCreate, LeaveOut, LeaveUpdate, LeaveUserOut, WhoIsOutEntry
from app.services.leave_service import compute_business_days
from app.services.state_machine import LEAVE_TRANSITIONS, validate_transition

router = APIRouter(prefix="/leave", tags=["leave"])


async def _user_out(user: User) -> LeaveUserOut:
    return LeaveUserOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        department=user.department,
        role=user.role,
    )


async def _leave_to_out(leave: Leave) -> LeaveOut:
    user = await User.get(leave.user_id)
    approver = await User.get(leave.approver_id) if leave.approver_id else None
    return LeaveOut(
        id=leave.id,
        user_id=leave.user_id,
        user=await _user_out(user),
        leave_type=leave.leave_type,
        status=leave.status,
        start_date=leave.start_date,
        end_date=leave.end_date,
        days=leave.days,
        reason=leave.reason,
        approver_id=leave.approver_id,
        approver=await _user_out(approver) if approver else None,
        approver_comment=leave.approver_comment,
        created_at=leave.created_at,
        updated_at=leave.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /leave/who-is-out  — must be defined BEFORE /leave/{id}
# ---------------------------------------------------------------------------
@router.get("/who-is-out", response_model=list[WhoIsOutEntry])
async def who_is_out(
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    leaves = await Leave.find(
        Leave.status == LeaveStatus.APPROVED,
        Leave.start_date <= today,
        Leave.end_date >= today,
    ).sort(+Leave.start_date).to_list()

    seen = set()
    result = []
    for leave in leaves:
        if leave.user_id in seen:
            continue
        seen.add(leave.user_id)
        user = await User.get(leave.user_id)
        if user:
            u_out = await _user_out(user)
            result.append(WhoIsOutEntry(
                user=u_out,
                leave_type=leave.leave_type,
                start_date=leave.start_date,
                end_date=leave.end_date,
                days=leave.days,
            ))
    return result


# ---------------------------------------------------------------------------
# GET /leave/
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[LeaveOut])
async def list_leaves(
    user_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
):
    is_manager_or_above = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}

    if not is_manager_or_above and user_id != current_user.id:
        user_id = current_user.id

    query = Leave.find()
    if user_id:
        query = query.find(Leave.user_id == user_id)

    if status_filter:
        try:
            status_enum = LeaveStatus(status_filter.upper())
            query = query.find(Leave.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status: {status_filter}",
            )

    leaves = await query.sort(-Leave.created_at).to_list()
    return [await _leave_to_out(l) for l in leaves]


# ---------------------------------------------------------------------------
# POST /leave/
# ---------------------------------------------------------------------------
@router.post("/", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
async def create_leave(
    payload: LeaveCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    days = compute_business_days(payload.start_date, payload.end_date)
    leave = Leave(
        user_id=current_user.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days=days,
        reason=payload.reason,
        status=LeaveStatus.PENDING,
    )
    await leave.insert()

    from app.services.notification_service import notify_leave_status_change
    background_tasks.add_task(notify_leave_status_change, str(leave.id))

    return await _leave_to_out(leave)


# ---------------------------------------------------------------------------
# GET /leave/{id}
# ---------------------------------------------------------------------------
@router.get("/{leave_id}", response_model=LeaveOut)
async def get_leave(
    leave_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    leave = await Leave.get(leave_id)
    if leave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")

    if current_user.role == UserRole.EMPLOYEE and leave.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return await _leave_to_out(leave)


# ---------------------------------------------------------------------------
# PATCH /leave/{id}
# ---------------------------------------------------------------------------
@router.patch("/{leave_id}", response_model=LeaveOut)
async def update_leave(
    leave_id: uuid.UUID,
    payload: LeaveUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    leave = await Leave.get(leave_id)
    if leave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")

    is_manager_or_above = current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}
    is_owner = leave.user_id == current_user.id

    if not is_manager_or_above and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    status_changed = False
    if payload.status is not None:
        if not is_manager_or_above:
            if payload.status != LeaveStatus.CANCELLED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Employees can only cancel their own leaves",
                )
            if not is_owner:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        validate_transition(leave.status, payload.status, LEAVE_TRANSITIONS)
        leave.status = payload.status

        if is_manager_or_above and payload.status in {LeaveStatus.APPROVED, LeaveStatus.REJECTED}:
            leave.approver_id = current_user.id

        leave.updated_at = datetime.now(UTC)
        status_changed = True

    if payload.approver_comment is not None:
        if not is_manager_or_above:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers can add approver comments",
            )
        leave.approver_comment = payload.approver_comment

    content_updated = False
    if is_owner and leave.status == LeaveStatus.PENDING:
        if payload.leave_type is not None:
            leave.leave_type = payload.leave_type
            content_updated = True
        if payload.start_date is not None:
            leave.start_date = payload.start_date
            content_updated = True
        if payload.end_date is not None:
            leave.end_date = payload.end_date
            content_updated = True
        if payload.reason is not None:
            leave.reason = payload.reason
            content_updated = True
        if content_updated:
            leave.days = compute_business_days(leave.start_date, leave.end_date)
            leave.updated_at = datetime.now(UTC)

    await leave.save()

    if status_changed or content_updated:
        from app.services.notification_service import notify_leave_status_change
        background_tasks.add_task(notify_leave_status_change, str(leave.id))

    return await _leave_to_out(leave)


# ---------------------------------------------------------------------------
# DELETE /leave/{id}
# ---------------------------------------------------------------------------
@router.delete("/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leave(
    leave_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    leave = await Leave.get(leave_id)
    if leave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")

    is_admin = current_user.role in {UserRole.ADMIN, UserRole.OWNER}
    is_owner = leave.user_id == current_user.id

    if not is_admin and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not is_admin and leave.status not in {LeaveStatus.PENDING, LeaveStatus.CANCELLED}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PENDING or CANCELLED leaves can be deleted by the owner",
        )

    await leave.delete()
