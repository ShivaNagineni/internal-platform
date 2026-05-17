"""
Seed the internal_app MongoDB database with realistic demo data.
Run from the backend/ directory:
    .venv/bin/python seed.py
"""
import asyncio
import uuid
from datetime import date, datetime, timedelta, UTC

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie


# ── helpers ──────────────────────────────────────────────────────────────────

def _uid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(UTC)


def _date(offset_days: int = 0) -> date:
    return date.today() + timedelta(days=offset_days)


# ── main ─────────────────────────────────────────────────────────────────────

async def seed():
    from app.models.user import User, UserRole
    from app.models.leave import Leave, LeaveType, LeaveStatus
    from app.models.idea import Idea, IdeaCategory, IdeaStatus, IdeaVote
    from app.models.release import Release, ReleaseStatus

    client = AsyncIOMotorClient("mongodb://localhost:27017/")
    await init_beanie(
        database=client["internal_app"],
        document_models=[User, Leave, Idea, IdeaVote, Release],
    )

    # ── Users (skip if already seeded) ────────────────────────────────────────
    # ── Clean up existing demo collections & mock users ────────────────────────
    await Leave.find().delete()
    await Idea.find().delete()
    await IdeaVote.find().delete()
    await Release.find().delete()
    for mock_email in [
        "admin@company.com",
        "manager@company.com",
        "alice@company.com",
        "bob@company.com",
        "carol@company.com",
        "manager@tekyantra.com",
        "alice@tekyantra.com",
        "bob@tekyantra.com",
        "carol@tekyantra.com",
    ]:
        await User.find(User.email == mock_email).delete()

    # ── Shiva & Ashwani (Admins) ──────────────────────────────────────────────
    shiva = await User.find_one(User.azure_oid == "a6775829-c905-4334-b905-421214f54132")
    if not shiva:
        shiva = await User.find_one({"email": {"$in": ["shiva.nagineni@tekyantra.com", "shiva.kumar.nagineni@gmail.com"]}})
    if not shiva:
        shiva = User(
            azure_oid="a6775829-c905-4334-b905-421214f54132",
            email="shiva.kumar.nagineni@gmail.com",
            display_name="Shiva Nagineni",
            department="Engineering",
            role=UserRole.OWNER,
        )
        await shiva.insert()
    else:
        shiva.role = UserRole.OWNER
        await shiva.save()

    # ── Ideas from Google Sheet (creates team members) ────────────────────────
    import csv, httpx
    from io import StringIO

    url = "https://docs.google.com/spreadsheets/d/1qsRadrC0a6lZrMtul6nO5FmBnHiBJgFkaqNQlkvyVoI/export?format=csv"
    with httpx.Client(follow_redirects=True) as client_http:
        resp = client_http.get(url)
    rows = list(csv.DictReader(StringIO(resp.text)))

    user_map = {"Shiva": shiva}
    for r in rows:
        c_name = r.get("Contributor", "").strip()
        if not c_name or c_name in user_map:
            continue
        u_email = f"{c_name.lower()}@tekyantra.com"
        u = await User.find_one(User.email == u_email)
        if not u:
            role = UserRole.ADMIN if c_name.lower() == "ashwani" else UserRole.EMPLOYEE
            u = User(
                azure_oid=f"seed-{c_name.lower()}-oid",
                email=u_email,
                display_name=c_name,
                department="Engineering" if c_name.lower() == "ashwani" else "Innovation",
                role=role,
            )
            await u.insert()
        else:
            if c_name.lower() == "ashwani" and u.role != UserRole.ADMIN:
                u.role = UserRole.ADMIN
                await u.save()
        user_map[c_name] = u

    # Explicitly ensure Ashwani is ADMIN if already in map
    ashwani = user_map.get("Ashwani")
    if ashwani and ashwani.role != UserRole.ADMIN:
        ashwani.role = UserRole.ADMIN
        await ashwani.save()

    all_voters = list(user_map.values())

    def get_category(title: str, desc: str) -> IdeaCategory:
        text = (title + " " + desc).lower()
        if any(k in text for k in ["ai", "model", "mcp", "docker", "ssl", "plugin", "tool", "deploy", "tech", "site", "bot", "n8n", "scanner"]):
            return IdeaCategory.TECH
        if any(k in text for k in ["standup", "kt", "session", "pricing", "revision", "standardization", "process", "migration", "cost"]):
            return IdeaCategory.PROCESS
        if any(k in text for k in ["award", "recognition", "gallery", "event", "community", "hub", "activity", "sharing"]):
            return IdeaCategory.CULTURE
        return IdeaCategory.PRODUCT

    def get_status(sprint_val: str, exec_val: str) -> IdeaStatus:
        sprint_val = sprint_val.strip().upper()
        exec_val = exec_val.strip().upper()
        if exec_val == "TRUE":
            return IdeaStatus.IMPLEMENTED
        if sprint_val == "TRUE":
            return IdeaStatus.APPROVED
        if sprint_val == "FALSE" or exec_val == "FALSE":
            return IdeaStatus.UNDER_REVIEW
        return IdeaStatus.SUBMITTED

    for r in rows:
        title = r.get("Idea Title", "").strip()
        if not title:
            continue
        desc = r.get("Description", "").strip()
        contrib = r.get("Contributor", "").strip()
        author = user_map.get(contrib, shiva)

        peer_votes_str = r.get("Peer Votes", "").strip()
        upvotes = int(peer_votes_str) if peer_votes_str.isdigit() else 0

        status = get_status(r.get("Selected for Sprint", ""), r.get("Execution Milestone", ""))
        category = get_category(title, desc)

        idea = Idea(
            title=title,
            description=desc or title,
            author_id=author.id,
            category=category,
            status=status,
            upvote_count=upvotes,
        )
        await idea.insert()

        if upvotes > 0:
            voters = [v for v in all_voters if v.id != author.id]
            for voter in voters[:upvotes]:
                await IdeaVote(idea_id=idea.id, user_id=voter.id).insert()

    print(f"  ✓ {await Idea.find().count()} ideas, {await IdeaVote.find().count()} votes from Google Sheet")

    # ── Releases (Exactly 1 in PLANNED mode) ──────────────────────────────────
    planned_release = Release(
        title="Tek Yantra Platform v2.0",
        version="2.0.0",
        description="Unified MCP servers, N8N automation, and AI website builder deployment.",
        release_date=_date(30),
        status=ReleaseStatus.PLANNED,
        owner_id=shiva.id,
        changelog="- Complete role-based control for Admins (Shiva Nagineni & Ashwani)\n- Dynamic Google Sheet ideas integration\n- Automated MCP Server deployments",
    )
    await planned_release.insert()
    print(f"  ✓ {await Release.find().count()} releases (1 in PLANNED mode)")

    print("\n✅ Seed complete! Collections:")
    print(f"   users={await User.find().count()}  leaves={await Leave.find().count()}  ideas={await Idea.find().count()}  releases={await Release.find().count()}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
