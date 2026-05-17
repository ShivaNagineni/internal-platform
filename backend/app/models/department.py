import uuid
from datetime import datetime, UTC
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


from enum import Enum

class LocationType(str, Enum):
    ONSHORE = "ONSHORE"
    OFFSHORE = "OFFSHORE"


class Department(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str
    description: Optional[str] = None
    location: LocationType = LocationType.ONSHORE
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "departments"
        indexes = [
            IndexModel([("name", ASCENDING)], unique=True),
        ]
