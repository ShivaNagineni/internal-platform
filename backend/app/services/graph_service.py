from __future__ import annotations
import logging
from datetime import datetime, UTC
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def _get_graph_token() -> str:
    settings = get_settings()
    if not settings.azure_ad_client_secret:
        raise ValueError("AZURE_AD_CLIENT_SECRET is not configured")
    url = f"https://login.microsoftonline.com/{settings.azure_ad_tenant_id}/oauth2/v2.0/token"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": settings.azure_ad_client_id,
            "client_secret": settings.azure_ad_client_secret,
            "scope": "https://graph.microsoft.com/.default",
        })
        resp.raise_for_status()
    return resp.json()["access_token"]


async def _fetch_all_graph_users() -> list[dict]:
    token = await _get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = (
        "https://graph.microsoft.com/v1.0/users"
        "?$select=id,displayName,mail,userPrincipalName,department,accountEnabled"
        "&$top=999"
    )
    users: list[dict] = []
    async with httpx.AsyncClient(timeout=60) as client:
        while url:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            users.extend(data.get("value", []))
            url = data.get("@odata.nextLink")
    return users


async def sync_users_from_azure() -> dict:
    from beanie.odm.operators.find.comparison import NotIn
    from app.models.user import User, UserRole

    graph_users = await _fetch_all_graph_users()
    created = 0
    updated = 0
    deleted = 0
    valid_oids = set()

    for gu in graph_users:
        azure_oid = gu.get("id")
        if not azure_oid:
            continue
        valid_oids.add(azure_oid)

        email = gu.get("mail") or gu.get("userPrincipalName") or ""
        display_name = gu.get("displayName") or email
        department = gu.get("department")
        is_active = gu.get("accountEnabled", True)

        existing = await User.find_one(User.azure_oid == azure_oid)
        if not existing and email:
            existing = await User.find_one(User.email == email)

        if existing:
            existing.azure_oid = azure_oid
            existing.email = email
            existing.display_name = display_name
            existing.department = department
            existing.is_active = is_active
            existing.updated_at = datetime.now(UTC)
            await existing.save()
            updated += 1
        else:
            await User(
                azure_oid=azure_oid,
                email=email,
                display_name=display_name,
                department=department,
                is_active=is_active,
                role=UserRole.EMPLOYEE,
            ).insert()
            created += 1

    if valid_oids:
        delete_query = User.find(NotIn(User.azure_oid, list(valid_oids)))
        deleted = await delete_query.count()
        if deleted > 0:
            await delete_query.delete()

    logger.info("Azure AD sync complete: created=%d updated=%d deleted=%d", created, updated, deleted)
    return {"created": created, "updated": updated, "deleted": deleted, "total": len(graph_users)}
