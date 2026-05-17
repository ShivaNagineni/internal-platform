from __future__ import annotations
from typing import Optional
from beanie import Document


class PlatformSettings(Document):
    """Singleton document storing runtime secrets that can't go in .env (e.g. OAuth refresh tokens)."""
    zoho_refresh_token: Optional[str] = None

    class Settings:
        name = "platform_settings"

    @classmethod
    async def get_instance(cls) -> "PlatformSettings":
        doc = await cls.find_one()
        if doc is None:
            doc = cls()
            await doc.insert()
        return doc
