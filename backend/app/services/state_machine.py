from fastapi import HTTPException, status
from app.models.leave import LeaveStatus
from app.models.idea import IdeaStatus
from app.models.release import ReleaseStatus

LEAVE_TRANSITIONS: dict[LeaveStatus, set[LeaveStatus]] = {
    LeaveStatus.PENDING: {LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED},
    LeaveStatus.APPROVED: {LeaveStatus.CANCELLED},
    LeaveStatus.REJECTED: set(),
    LeaveStatus.CANCELLED: set(),
}

IDEA_TRANSITIONS: dict[IdeaStatus, set[IdeaStatus]] = {
    IdeaStatus.SUBMITTED: {IdeaStatus.UNDER_REVIEW, IdeaStatus.REJECTED},
    IdeaStatus.UNDER_REVIEW: {IdeaStatus.APPROVED, IdeaStatus.REJECTED},
    IdeaStatus.APPROVED: {IdeaStatus.IMPLEMENTED},
    IdeaStatus.REJECTED: set(),
    IdeaStatus.IMPLEMENTED: set(),
}

RELEASE_TRANSITIONS: dict[ReleaseStatus, set[ReleaseStatus]] = {
    ReleaseStatus.PLANNED: {ReleaseStatus.IN_PROGRESS, ReleaseStatus.CANCELLED},
    ReleaseStatus.IN_PROGRESS: {ReleaseStatus.STAGING, ReleaseStatus.CANCELLED},
    ReleaseStatus.STAGING: {ReleaseStatus.RELEASED, ReleaseStatus.CANCELLED},
    ReleaseStatus.RELEASED: set(),
    ReleaseStatus.CANCELLED: set(),
}


def validate_transition(current, next_status, transitions: dict) -> None:
    allowed = transitions.get(current, set())
    if next_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from {current.value} to {next_status.value}. "
                   f"Allowed: {[s.value for s in allowed] or 'none'}",
        )
