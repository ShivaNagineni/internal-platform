from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from beanie.odm.operators.find.comparison import In

from app.core.auth import get_current_user
from app.models.idea import Idea, IdeaStatus
from app.models.leave import Leave, LeaveStatus
from app.models.release import Release, ReleaseStatus
from app.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    pending_leaves = await Leave.find(Leave.status == LeaveStatus.PENDING).count()

    approved_leaves_today = await Leave.find(
        Leave.status == LeaveStatus.APPROVED,
        Leave.start_date <= today,
        Leave.end_date >= today,
    ).count()

    total_ideas = await Idea.find().count()

    ideas_under_review = await Idea.find(Idea.status == IdeaStatus.UNDER_REVIEW).count()

    upcoming_releases = await Release.find(
        In(Release.status, [ReleaseStatus.PLANNED, ReleaseStatus.IN_PROGRESS]),
        Release.release_date >= today,
    ).count()

    active_releases = await Release.find(
        In(Release.status, [ReleaseStatus.IN_PROGRESS, ReleaseStatus.STAGING])
    ).count()

    return {
        "pending_leaves": pending_leaves,
        "approved_leaves_today": approved_leaves_today,
        "total_ideas": total_ideas,
        "ideas_under_review": ideas_under_review,
        "upcoming_releases": upcoming_releases,
        "active_releases": active_releases,
    }
