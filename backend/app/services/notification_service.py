import uuid
from app.models.leave import Leave
from app.models.idea import Idea
from app.models.release import Release
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType


async def notify_leave_status_change(leave_id: str):
    leave = await Leave.get(uuid.UUID(leave_id))
    if not leave:
        return

    user = await User.get(leave.user_id)
    if not user:
        return

    approvers = await User.find({"role": {"$in": ["MANAGER", "ADMIN"]}}).to_list()
    recipients = list(approvers)

    for rec in recipients:
        n = Notification(
            recipient_id=rec.id,
            title=f"Leave {leave.status.value}",
            message=f"{user.display_name} requested leave ({leave.start_date} → {leave.end_date})",
            type=NotificationType.LEAVE,
            link="/leave",
        )
        await n.insert()

    if leave.status.value != "PENDING" and leave.user_id:
        n = Notification(
            recipient_id=leave.user_id,
            title=f"Leave Request {leave.status.value}",
            message=f"Your leave request for {leave.start_date} was {leave.status.value.lower()}.",
            type=NotificationType.LEAVE,
            link="/leave",
        )
        await n.insert()

    if leave.status.value == "PENDING":
        from app.services.slack import slack_service
        await slack_service.send_leave_webhook(leave, user)


async def notify_idea_status_change(idea_id: str):
    idea = await Idea.get(uuid.UUID(idea_id))
    if not idea:
        return

    user = await User.get(idea.author_id)
    if not user:
        return

    admins = await User.find(User.role == UserRole.ADMIN).to_list()
    for admin in admins:
        n = Notification(
            recipient_id=admin.id,
            title=f"Idea {idea.status.value}",
            message=f"{user.display_name}: {idea.title}",
            type=NotificationType.IDEA,
            link="/ideas",
        )
        await n.insert()

    if idea.author_id and idea.status.value != "SUBMITTED":
        n = Notification(
            recipient_id=idea.author_id,
            title=f"Idea {idea.status.value}",
            message=f"Your idea '{idea.title}' is now {idea.status.value.lower()}",
            type=NotificationType.IDEA,
            link="/ideas",
        )
        await n.insert()


async def notify_release_status_change(release_id: str):
    release = await Release.get(uuid.UUID(release_id))
    if not release:
        return

    owner = await User.get(release.owner_id) if release.owner_id else None

    approvers = await User.find({"role": {"$in": ["MANAGER", "ADMIN"]}}).to_list()
    shiva_user = await User.find_one({"email": {"$in": ["shiva.nagineni@tekyantra.com", "shiva.kumar.nagineni@gmail.com"]}})
    recipients = list(approvers)
    if shiva_user and not any(a.id == shiva_user.id for a in recipients):
        recipients.append(shiva_user)

    for rec in recipients:
        n = Notification(
            recipient_id=rec.id,
            title=f"Release {release.version} {release.status.value}",
            message=f"Release '{release.title}' is now {release.status.value}",
            type=NotificationType.RELEASE,
            link="/releases",
        )
        await n.insert()

    if release.owner_id and owner and not any(a.id == release.owner_id for a in recipients):
        n = Notification(
            recipient_id=release.owner_id,
            title=f"Release {release.version} {release.status.value}",
            message=f"Your release '{release.title}' is now {release.status.value}",
            type=NotificationType.RELEASE,
            link="/releases",
        )
        await n.insert()

    # IN_PROGRESS is an automatic intermediate state (qa→main PR just opened).
    # The STAGING message already has the "Approve Release" button, so skip
    # sending a duplicate Slack notification here.
    if release.status.value != "IN_PROGRESS":
        from app.services.slack import slack_service
        await slack_service.send_release_webhook(release, owner)

    if release.status.value == "STAGING":
        from app.services.github_api import create_qa_to_main_pr
        await create_qa_to_main_pr(release.version, release.title)
