import uuid
from datetime import datetime, UTC
from enum import Enum
from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class IdeaStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IMPLEMENTED = "IMPLEMENTED"


class IdeaCategory(str, Enum):
    PRODUCT = "PRODUCT"
    PROCESS = "PROCESS"
    TECH = "TECH"
    CULTURE = "CULTURE"
    OTHER = "OTHER"


class Idea(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    title: str
    description: str
    author_id: uuid.UUID
    status: IdeaStatus = IdeaStatus.SUBMITTED
    category: IdeaCategory = IdeaCategory.OTHER
    upvote_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "ideas"
        indexes = [
            IndexModel([("author_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]


class IdeaVote(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    idea_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "idea_votes"
        indexes = [
            IndexModel([("idea_id", ASCENDING), ("user_id", ASCENDING)], unique=True),
        ]
