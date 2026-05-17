from __future__ import annotations
import logging
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"
_ZOHO_PEOPLE_URL = "https://people.zoho.com/people/api/forms/employee/getRecords"


async def _get_access_token(refresh_token: str) -> str | None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _ZOHO_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "client_id": settings.zoho_client_id,
                "client_secret": settings.zoho_client_secret,
                "refresh_token": refresh_token,
            },
        )
        data = resp.json()
        token = data.get("access_token")
        if not token:
            logger.error("Failed to refresh Zoho access token: %s", data)
        return token


async def sync_users_from_zoho() -> dict:
    from app.models.platform_settings import PlatformSettings
    from app.models.user import User, UserRole

    ps = await PlatformSettings.get_instance()
    if not ps.zoho_refresh_token:
        raise ValueError("No Zoho refresh token stored — a Zoho user must log in at least once first")

    access_token = await _get_access_token(ps.zoho_refresh_token)
    if not access_token:
        raise ValueError("Could not obtain a Zoho access token from the stored refresh token")

    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
    employees: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        page = 1
        while True:
            resp = await client.get(
                _ZOHO_PEOPLE_URL,
                headers=headers,
                params={"page": page, "limit": 200},
            )
            if resp.status_code != 200:
                logger.error("Zoho People API error: %s %s", resp.status_code, resp.text)
                break

            data = resp.json()
            records = data.get("response", {}).get("result", [])
            if not records:
                break

            # result can be a list or a dict keyed by record id
            if isinstance(records, dict):
                records = list(records.values())

            employees.extend(records)
            if len(records) < 200:
                break
            page += 1

    created = updated = skipped = 0

    for emp in employees:
        # Zoho People field names vary; handle common variants
        email = (
            emp.get("EmailID") or emp.get("Email") or emp.get("email") or ""
        ).strip().lower()
        first = emp.get("FirstName") or emp.get("first_name") or ""
        last = emp.get("LastName") or emp.get("last_name") or ""
        display_name = f"{first} {last}".strip() or email

        if not email:
            skipped += 1
            continue

        existing = await User.find_one(User.email == email)
        if existing:
            # Only update display_name if it hasn't been manually changed
            changed = False
            if not existing.display_name and display_name:
                existing.display_name = display_name
                changed = True
            if changed:
                await existing.save()
                updated += 1
            else:
                skipped += 1
        else:
            user = User(
                email=email,
                display_name=display_name,
                role=UserRole.EMPLOYEE,
            )
            await user.insert()
            created += 1

    logger.info("Zoho People sync: created=%d updated=%d skipped=%d", created, updated, skipped)
    return {"created": created, "updated": updated, "skipped": skipped, "total": len(employees)}
