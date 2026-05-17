import uuid
from datetime import datetime, UTC
from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class Repository(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str
    github_repo: str
    dev_branch: str = "Development"
    qa_branch: str = "Qa"
    main_branch: str = "main"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "repositories"
        indexes = [
            IndexModel([("github_repo", ASCENDING)], unique=True),
        ]
