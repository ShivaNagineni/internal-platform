from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

settings = get_settings()

_motor_client: AsyncIOMotorClient | None = None


def get_motor_client() -> AsyncIOMotorClient:
    global _motor_client
    if _motor_client is None:
        _motor_client = AsyncIOMotorClient(settings.mongo_uri)
    return _motor_client


async def init_db() -> None:
    from beanie import init_beanie
    from app.models.user import User
    from app.models.leave import Leave
    from app.models.idea import Idea, IdeaVote
    from app.models.release import Release
    from app.models.notification import Notification
    from app.models.platform_settings import PlatformSettings
    from app.models.department import Department
    from app.models.repository import Repository
    from app.models.wiki import WikiDocument

    client = get_motor_client()
    await init_beanie(
        database=client[settings.db_name],
        document_models=[User, Leave, Idea, IdeaVote, Release, Notification, PlatformSettings, Department, Repository, WikiDocument],
    )
