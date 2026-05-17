from __future__ import annotations
import httpx
from app.core.config import get_settings

settings = get_settings()


class SlackService:
    def __init__(self) -> None:
        token = settings.slack_bot_token.strip() if settings.slack_bot_token else "mock-token"
        self._client = httpx.AsyncClient(
            base_url="https://slack.com/api",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )

    async def post_message(self, channel: str, blocks: list[dict], text: str = "") -> str | None:
        if not settings.slack_bot_token or settings.slack_bot_token == "mock":
            import uuid
            ts = f"1700000000.{uuid.uuid4().hex[:6]}"
            print(f"[SLACK SIMULATOR] postMessage to {channel} (ts={ts}): {text or blocks[0].get('text', {}).get('text')}")
            return ts
        try:
            resp = await self._client.post(
                "/chat.postMessage",
                json={"channel": channel, "blocks": blocks, "text": text},
            )
            data = resp.json()
            if not data.get("ok"):
                print(f"[SLACK ERROR] postMessage failed: {data}")
            return data.get("ts") if data.get("ok") else None
        except Exception as e:
            print(f"[SLACK EXCEPTION] postMessage failed: {e}")
            return None

    async def update_message(self, channel: str, ts: str, blocks: list[dict], text: str = "") -> None:
        if not settings.slack_bot_token or settings.slack_bot_token == "mock":
            print(f"[SLACK SIMULATOR] updateMessage in {channel} (ts={ts})")
            return
        try:
            resp = await self._client.post(
                "/chat.update",
                json={"channel": channel, "ts": ts, "blocks": blocks, "text": text},
            )
            data = resp.json()
            if not data.get("ok"):
                print(f"[SLACK ERROR] updateMessage failed: {data}")
        except Exception as e:
            print(f"[SLACK EXCEPTION] updateMessage failed: {e}")

    async def close(self) -> None:
        await self._client.aclose()

    async def send_leave_webhook(self, leave, user) -> None:
        url = settings.slack_webhook_url
        if not url:
            return
        blocks = self.build_leave_notification(leave, user, leave.status.value.title())
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json={"blocks": blocks})
                print(f"[SLACK WEBHOOK] Posted leave {leave.id}, status={resp.status_code}")
        except Exception as e:
            print(f"[SLACK WEBHOOK ERROR] send_leave_webhook failed: {e}")

    def build_leave_notification(self, leave, user, action: str) -> list[dict]:
        status_emoji = {"APPROVED": "✅", "REJECTED": "❌", "PENDING": "⏳", "CANCELLED": "🚫"}.get(
            leave.status.value, "📋"
        )
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{status_emoji} Leave Request {action}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Employee:*\n{user.display_name}"},
                    {"type": "mrkdwn", "text": f"*Email:*\n{user.email}"},
                    {"type": "mrkdwn", "text": f"*Type:*\n{leave.leave_type.value}"},
                    {"type": "mrkdwn", "text": f"*Dates:*\n{leave.start_date} → {leave.end_date}"},
                    {"type": "mrkdwn", "text": f"*Days:*\n{leave.days}"},
                    {"type": "mrkdwn", "text": f"*Status:*\n{leave.status.value}"},
                    {"type": "mrkdwn", "text": f"*Reason:*\n{leave.reason[:100]}"},
                ],
            },
            {"type": "divider"},
        ]

        if leave.status.value == "PENDING":
            # FIXED: Dropped 'url' parameter so it executes as a native interaction rather than an external web link.
            # FIXED: Configured payloads to pass both parameters cleanly to your catch-all endpoint.
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve", "emoji": True},
                        "style": "primary",
                        "value": f"approve:{leave.id}",
                        "action_id": "leave_approve",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Reject", "emoji": True},
                        "style": "danger",
                        "value": f"reject:{leave.id}",
                        "action_id": "leave_reject",
                    },
                ],
            })
            blocks.append({"type": "divider"})

        return blocks

    def build_idea_notification(self, idea, user, action: str) -> list[dict]:
        status_emoji = {
            "SUBMITTED": "💡",
            "UNDER_REVIEW": "🔍",
            "APPROVED": "✅",
            "REJECTED": "❌",
            "IMPLEMENTED": "🚀",
        }.get(idea.status.value, "💡")
        return [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{status_emoji} Innovation Hub: {action}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Idea:*\n{idea.title}"},
                    {"type": "mrkdwn", "text": f"*Author:*\n{user.display_name}"},
                    {"type": "mrkdwn", "text": f"*Category:*\n{idea.category.value}"},
                    {"type": "mrkdwn", "text": f"*Status:*\n{idea.status.value}"},
                    {"type": "mrkdwn", "text": f"*Upvotes:*\n{idea.upvote_count}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Description:*\n{idea.description[:200]}"},
            },
            {"type": "divider"},
        ]

    async def send_release_webhook(self, release, user) -> None:
        url = settings.slack_webhook_url
        if not url:
            return
        blocks = self.build_release_notification(release, user, release.status.value.title())
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json={"blocks": blocks})
                print(f"[SLACK WEBHOOK] Posted release {release.id}, status={resp.status_code}")
        except Exception as e:
            print(f"[SLACK WEBHOOK ERROR] send_release_webhook failed: {e}")

    def build_release_notification(self, release, user, action: str) -> list[dict]:
        status_emoji = {
            "PLANNED": "📅",
            "IN_PROGRESS": "🔧",
            "STAGING": "🧪",
            "RELEASED": "🚀",
            "CANCELLED": "🚫",
        }.get(release.status.value, "📦")
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{status_emoji} Release {action}: v{release.version}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Title:*\n{release.title}"},
                    {"type": "mrkdwn", "text": f"*Version:*\n{release.version}"},
                    {"type": "mrkdwn", "text": f"*Owner:*\n{user.display_name}"},
                    {"type": "mrkdwn", "text": f"*Status:*\n{release.status.value}"},
                    {"type": "mrkdwn", "text": f"*Release Date:*\n{release.release_date}"},
                ],
            },
            {"type": "divider"},
        ]

        if release.status.value == "PLANNED":
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Start Deployment", "emoji": True},
                        "style": "primary",
                        "value": f"start_release:{release.id}",
                        "action_id": "release_start",
                    },
                ],
            })
            blocks.append({"type": "divider"})
        elif release.status.value == "STAGING":
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve Release", "emoji": True},
                        "style": "primary",
                        "value": f"approve_release:{release.id}",
                        "action_id": "release_approve",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Reject Release", "emoji": True},
                        "style": "danger",
                        "value": f"reject_release:{release.id}",
                        "action_id": "release_reject",
                    },
                ],
            })
            blocks.append({"type": "divider"})

        return blocks


slack_service = SlackService()
