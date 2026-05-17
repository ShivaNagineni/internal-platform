import hashlib
import hmac
import json
import logging
import re
import time
import uuid
from datetime import datetime, UTC
import httpx
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import HTMLResponse
from app.core.config import get_settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
settings = get_settings()
logger = logging.getLogger(__name__)

_VERSION_RE = re.compile(r'v\d+\.\d+\.\d+')

# Status advancement order for GitHub-driven releases
_STATUS_RANK = {
    "PLANNED": 0,
    "STAGING": 1,
    "IN_PROGRESS": 2,
    "RELEASED": 3,
}


@router.get("/leave-direct-action", response_class=HTMLResponse)
async def leave_direct_action(leave_id: uuid.UUID, action: str):
    from app.models.leave import Leave, LeaveStatus
    from app.models.user import User
    from app.services.notification_service import notify_leave_status_change

    try:
        leave = await Leave.get(leave_id)
        if not leave:
            return HTMLResponse("<h1>❌ Leave request not found.</h1>", status_code=404)

        if leave.status != LeaveStatus.PENDING:
            status_text = leave.status.value
            return HTMLResponse(f"<h1>⚠️ Leave request has already been processed ({status_text}).</h1>")

        new_status = LeaveStatus.APPROVED if action.lower() == "approve" else LeaveStatus.REJECTED
        leave.status = new_status
        leave.updated_at = datetime.now(UTC)
        await leave.save()

        await notify_leave_status_change(str(leave.id))

        status_icon = "✅" if new_status == LeaveStatus.APPROVED else "❌"
        status_color = "#10b981" if new_status == LeaveStatus.APPROVED else "#ef4444"
        html_content = f"""
        <html>
            <head>
                <title>Leave Request {new_status.value}</title>
                <style>
                    body {{ font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; }}
                    .card {{ background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 28rem; width: 100%; }}
                    h1 {{ color: {status_color}; font-size: 1.75rem; margin-bottom: 0.5rem; }}
                    p {{ color: #64748b; font-size: 1rem; margin-top: 0; }}
                    a {{ display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background-color: #6366f1; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">{status_icon}</div>
                    <h1>Leave Request {new_status.value.title()}</h1>
                    <p>The leave request has been successfully updated in the system.</p>
                    <a href="javascript:window.close()">Close Window</a>
                </div>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    except Exception as e:
        print(f"[DIRECT ACTION ERROR] {e}")
        return HTMLResponse(f"<h1>❌ Error processing request: {e}</h1>", status_code=500)


def _verify_github_signature(body: bytes, signature: str) -> bool:
    if not settings.github_webhook_secret:
        return True
    expected = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _advance_release_status(release, new_status) -> bool:
    from app.models.release import ReleaseStatusEntry
    if _STATUS_RANK.get(new_status.value, -1) <= _STATUS_RANK.get(release.status.value, -1):
        return False
    now = datetime.now(UTC)
    release.status = new_status
    release.status_history.append(ReleaseStatusEntry(status=new_status, changed_at=now))
    release.updated_at = now
    await release.save()
    return True


async def _release_matches_repo(release, pr_repo_full_name: str) -> bool:
    """Returns True if a release should respond to a webhook from the given repo."""
    from app.models.repository import Repository
    if release.repository_ids:
        for repo_id in release.repository_ids:
            repo = await Repository.get(repo_id)
            if repo and repo.github_repo.lower() == (pr_repo_full_name or "").lower():
                return True
        return False
    
    # Backward compat: no repository_ids → match against settings.github_repos
    configured = [r.lower() for r in settings.get_github_repos()]
    return (pr_repo_full_name or "").lower() in configured


def _is_qa_branch_for_release(release, base_branch_lower: str) -> bool:
    """Determine if the base branch matches the release's repo qa_branch."""
    if release is None:
        return base_branch_lower == "qa"
    # Without an explicit repository_id we fall back to the legacy "qa" name
    return base_branch_lower == "qa"


async def _handle_github_pr(payload: dict) -> None:
    from app.models.release import Release, ReleaseStatus, ReleaseStatusEntry
    from app.models.repository import Repository

    action = payload.get("action")
    pr = payload.get("pull_request", {})
    base_branch = pr.get("base", {}).get("ref", "").lower()
    head_branch = pr.get("head", {}).get("ref", "")
    pr_title = pr.get("title", "")
    merged = pr.get("merged", False)
    pr_repo_full_name = (payload.get("repository", {}) or {}).get("full_name", "")

    version_match = _VERSION_RE.search(pr_title) or _VERSION_RE.search(head_branch)
    if not version_match:
        logger.info("GitHub PR has no version pattern, skipping: %s", pr_title)
        return

    version = version_match.group(0).lstrip("v")

    from app.services.notification_service import notify_release_status_change

    # Determine what branch role this base corresponds to for the matched release.
    # First try to find an existing release for this version that belongs to the right repo.
    candidate_release = None
    candidates = await Release.find(Release.version == version).to_list()
    for r in candidates:
        if await _release_matches_repo(r, pr_repo_full_name):
            candidate_release = r
            break

    # Resolve which branch role this base belongs to.
    branch_role: str | None = None
    if candidate_release and candidate_release.repository_ids:
        # Check all repositories tied to this release
        for repo_id in candidate_release.repository_ids:
            repo = await Repository.get(repo_id)
            if repo and repo.github_repo.lower() == pr_repo_full_name.lower():
                if base_branch == repo.qa_branch.lower():
                    branch_role = "qa"
                elif base_branch == repo.main_branch.lower():
                    branch_role = "main"
                break
    if branch_role is None:
        # Fallback default: classic naming
        if base_branch == "qa":
            branch_role = "qa"
        elif base_branch in ("main", "master"):
            branch_role = "main"

    if branch_role is None:
        logger.info("GitHub PR base branch %s not recognized as qa/main — skipping", base_branch)
        return

    if action == "opened" and branch_role == "qa":
        if candidate_release:
            return
        # Try to auto-attach a repository_id by matching the webhook repo against our Repository docs
        matched_repo = await Repository.find_one(Repository.github_repo == pr_repo_full_name)
        now = datetime.now(UTC)
        repo_ids = [matched_repo.id] if matched_repo else []
        pr_numbers = {str(matched_repo.id): pr.get("number")} if matched_repo and pr.get("number") else {}
        release = Release(
            title=pr_title,
            version=version,
            status=ReleaseStatus.PLANNED,
            status_history=[ReleaseStatusEntry(status=ReleaseStatus.PLANNED, changed_at=now)],
            pr_numbers=pr_numbers,
            repository_ids=repo_ids,
        )
        await release.insert()
        logger.info("Created release %s from GitHub PR", version)
        await notify_release_status_change(str(release.id))

    elif action == "closed" and merged and branch_role == "qa":
        if candidate_release:
            advanced = await _advance_release_status(candidate_release, ReleaseStatus.STAGING)
            if advanced:
                logger.info("Release %s advanced to STAGING", version)
                await notify_release_status_change(str(candidate_release.id))

    elif action == "opened" and branch_role == "main":
        if candidate_release:
            matched_repo = await Repository.find_one(Repository.github_repo == pr_repo_full_name)
            if not candidate_release.main_pr_numbers:
                candidate_release.main_pr_numbers = {}
            if matched_repo:
                candidate_release.main_pr_numbers[str(matched_repo.id)] = pr.get("number")
            else:
                candidate_release.main_pr_numbers["default"] = pr.get("number")
            await candidate_release.save()
            advanced = await _advance_release_status(candidate_release, ReleaseStatus.IN_PROGRESS)
            if advanced:
                logger.info("Release %s advanced to IN_PROGRESS", version)
                await notify_release_status_change(str(candidate_release.id))

    elif action == "closed" and merged and branch_role == "main":
        if candidate_release:
            advanced = await _advance_release_status(candidate_release, ReleaseStatus.RELEASED)
            if advanced:
                logger.info("Release %s advanced to RELEASED", version)
                await notify_release_status_change(str(candidate_release.id))


@router.post("/github")
async def github_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not _verify_github_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub signature")

    event = request.headers.get("X-GitHub-Event", "")
    if event == "ping":
        return {"ok": True}

    if event != "pull_request":
        return {"ok": True}

    payload = json.loads(body)
    await _handle_github_pr(payload)
    return {"ok": True}


def _verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    if not settings.slack_signing_secret:
        return True
    if abs(time.time() - float(timestamp)) > 300:
        return False
    base = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        settings.slack_signing_secret.encode(),
        base.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/slack")
async def slack_webhook(request: Request):
    body = await request.body()
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    if not _verify_slack_signature(body, timestamp, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Slack signature")

    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        raw_payload = form.get("payload")
        if raw_payload:
            payload = json.loads(raw_payload)
        else:
            payload = dict(form)

    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    event_type = payload.get("type")
    if event_type == "event_callback":
        _handle_event(payload.get("event", {}))
    elif event_type == "block_actions":
        await _handle_block_action(payload)
    elif event_type == "shortcut":
        pass

    return {"ok": True}


def _handle_event(event: dict) -> None:
    pass


async def _handle_block_action(payload: dict) -> None:
    actions = payload.get("actions", [])
    if not actions:
        return

    action = actions[0]
    action_id = action.get("action_id", "")
    value = action.get("value", "")

    if not value:
        return

    if action_id in ("leave_approve", "leave_reject") or action_id.startswith("leave_approve_") or action_id.startswith("leave_reject_"):
        from app.models.leave import Leave, LeaveStatus
        from app.models.user import User

        try:
            if ":" in value:
                leave_id_str = value.split(":")[-1]
            else:
                leave_id_str = value

            leave = await Leave.get(uuid.UUID(leave_id_str))
            if not leave:
                print(f"[SLACK ACTION] Leave {leave_id_str} not found in database")
                return

            if leave.status != LeaveStatus.PENDING:
                print(f"[SLACK ACTION] Leave {leave_id_str} already processed ({leave.status.value})")
                return

            if action_id == "leave_approve" or action_id.startswith("leave_approve_"):
                new_status = LeaveStatus.APPROVED
            else:
                new_status = LeaveStatus.REJECTED

            leave.status = new_status
            leave.updated_at = datetime.now(UTC)
            await leave.save()
            print(f"[SLACK ACTION] Successfully updated leave {leave.id} to {new_status.value}")

            user = await User.get(leave.user_id)
            if user:
                from app.services.slack import slack_service
                response_url = payload.get("response_url")
                action_str = "Approved" if new_status == LeaveStatus.APPROVED else "Rejected"
                blocks = slack_service.build_leave_notification(leave, user, action_str)

                if response_url:
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(response_url, json={"replace_original": True, "blocks": blocks})
                        print(f"[SLACK ACTION] Updated Slack message via response_url, status={resp.status_code}")

                from app.services.notification_service import notify_leave_status_change
                await notify_leave_status_change(str(leave.id))
        except Exception as e:
            print(f"[SLACK ACTION ERROR] {e}")
    elif action_id in ("release_start", "release_approve", "release_reject") or action_id.startswith("release_"):
        from app.models.release import Release, ReleaseStatus, ReleaseStatusEntry
        from app.models.user import User

        try:
            if ":" in value:
                release_id_str = value.split(":")[-1]
            else:
                release_id_str = value

            release = await Release.get(uuid.UUID(release_id_str))
            if not release:
                print(f"[SLACK ACTION] Release {release_id_str} not found in database")
                return

            if action_id == "release_start":
                if release.status != ReleaseStatus.PLANNED:
                    print(f"[SLACK ACTION] Release {release_id_str} not in PLANNED ({release.status.value})")
                    return

                response_url = payload.get("response_url")
                if release.pr_numbers:
                    from app.services.github_api import merge_pr
                    from app.models.repository import Repository as _Repo
                    merged_any = False
                    
                    if release.repository_ids:
                        for repo_id in release.repository_ids:
                            pr_num = release.pr_numbers.get(str(repo_id))
                            if pr_num:
                                repo_doc = await _Repo.get(repo_id)
                                if repo_doc:
                                    ok = await merge_pr(pr_num, github_repo=repo_doc.github_repo)
                                    if ok:
                                        merged_any = True
                    else:
                        # Legacy fallback — "default" key, repo resolved from settings
                        pr_num = release.pr_numbers.get("default")
                        if pr_num:
                            ok = await merge_pr(pr_num)
                            if ok:
                                merged_any = True
                                    
                    if response_url:
                        msg = "✅ Deployment approved — merging to QA. Status will update automatically." if merged_any \
                            else "❌ Could not merge the PRs. Please merge them manually on GitHub."
                        async with httpx.AsyncClient() as c:
                            await c.post(response_url, json={"replace_original": True, "text": msg, "blocks": []})
                else:
                    # No PR stored (manually created release) — advance to STAGING directly
                    now = datetime.now(UTC)
                    release.status = ReleaseStatus.STAGING
                    release.status_history.append(ReleaseStatusEntry(status=ReleaseStatus.STAGING, changed_at=now))
                    release.updated_at = now
                    await release.save()
                    from app.services.notification_service import notify_release_status_change
                    await notify_release_status_change(str(release.id))
                return

            elif action_id == "release_approve" or action_id.startswith("release_approve_"):
                if release.status not in (ReleaseStatus.STAGING, ReleaseStatus.IN_PROGRESS):
                    print(f"[SLACK ACTION] Release {release_id_str} not in STAGING/IN_PROGRESS ({release.status.value})")
                    return

                response_url = payload.get("response_url")
                if release.main_pr_numbers:
                    from app.services.github_api import merge_pr
                    from app.models.repository import Repository as _Repo
                    merged_any = False
                    
                    if release.repository_ids:
                        for repo_id in release.repository_ids:
                            pr_num = release.main_pr_numbers.get(str(repo_id))
                            if pr_num:
                                repo_doc = await _Repo.get(repo_id)
                                if repo_doc:
                                    ok = await merge_pr(pr_num, github_repo=repo_doc.github_repo)
                                    if ok:
                                        merged_any = True
                    else:
                        # Legacy fallback — "default" key, repo resolved from settings
                        pr_num = release.main_pr_numbers.get("default")
                        if pr_num:
                            ok = await merge_pr(pr_num)
                            if ok:
                                merged_any = True
                                    
                    if response_url:
                        msg = "✅ Release approved — merging to main. Status will update automatically." if merged_any \
                            else "❌ Could not merge the PRs. Please merge them manually on GitHub."
                        async with httpx.AsyncClient() as c:
                            await c.post(response_url, json={"replace_original": True, "text": msg, "blocks": []})
                else:
                    # No PR stored — advance to RELEASED directly
                    now = datetime.now(UTC)
                    release.status = ReleaseStatus.RELEASED
                    release.status_history.append(ReleaseStatusEntry(status=ReleaseStatus.RELEASED, changed_at=now))
                    release.updated_at = now
                    await release.save()
                    from app.services.notification_service import notify_release_status_change
                    await notify_release_status_change(str(release.id))
                return

            else:
                if release.status not in (ReleaseStatus.STAGING, ReleaseStatus.IN_PROGRESS):
                    print(f"[SLACK ACTION] Release {release_id_str} not in STAGING/IN_PROGRESS ({release.status.value})")
                    return
                new_status = ReleaseStatus.PLANNED
                action_str = "Rejected — back to Planned"

                release.status = new_status
                release.status_history.append(ReleaseStatusEntry(status=new_status, changed_at=datetime.now(UTC)))
                release.updated_at = datetime.now(UTC)
                await release.save()
                print(f"[SLACK ACTION] Successfully updated release {release.id} to {new_status.value}")

                from app.services.notification_service import notify_release_status_change
                await notify_release_status_change(str(release.id))
        except Exception as e:
            print(f"[SLACK ACTION ERROR] {e}")
