import uuid
from datetime import datetime, UTC
from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class WikiDocument(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    title: str
    content: str
    category: str = "General"
    tags: list[str] = Field(default_factory=list)
    author_id: uuid.UUID
    author_name: str
    author_email: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "wiki"
        indexes = [
            IndexModel([("author_id", ASCENDING)]),
            IndexModel([("category", ASCENDING)]),
        ]
