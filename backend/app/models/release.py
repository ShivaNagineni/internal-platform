import uuid
from datetime import date, datetime, UTC
from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel


class ReleaseStatus(str, Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    STAGING = "STAGING"
    RELEASED = "RELEASED"
    CANCELLED = "CANCELLED"


class ReleaseStatusEntry(BaseModel):
    status: ReleaseStatus
    changed_at: datetime


class Release(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    title: str
    version: str
    description: Optional[str] = None
    release_date: Optional[date] = None
    status: ReleaseStatus = ReleaseStatus.PLANNED
    status_history: list[ReleaseStatusEntry] = Field(default_factory=list)
    owner_id: Optional[uuid.UUID] = None
    repository_ids: list[uuid.UUID] = Field(default_factory=list)
    changelog: Optional[str] = None
    pr_numbers: dict[str, int] = Field(default_factory=dict)
    main_pr_numbers: dict[str, int] = Field(default_factory=dict)
    slack_ts: Optional[str] = None
    slack_channel: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "releases"
        indexes = [
            IndexModel([("version", ASCENDING)], unique=True),
            IndexModel([("owner_id", ASCENDING)]),
        ]
