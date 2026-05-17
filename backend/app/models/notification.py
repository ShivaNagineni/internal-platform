import uuid
from datetime import datetime, UTC
from enum import Enum
from pydantic import Field
from beanie import Document


class NotificationType(str, Enum):
    LEAVE = "LEAVE"
    IDEA = "IDEA"
    RELEASE = "RELEASE"
    SYSTEM = "SYSTEM"


class Notification(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    recipient_id: uuid.UUID
    title: str
    message: str
    type: NotificationType
    is_read: bool = False
    link: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "notifications"
