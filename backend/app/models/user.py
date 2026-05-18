import uuid
from datetime import datetime, UTC
from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class UserRole(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"
    OWNER = "OWNER"


class User(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    azure_oid: Optional[str] = None
    zoho_uid: Optional[str] = None
    email: str
    display_name: str
    department: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE
    theme: str = "dark"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("azure_oid", ASCENDING)], unique=True, sparse=True),
            IndexModel([("zoho_uid", ASCENDING)], unique=True, sparse=True),
            IndexModel([("email", ASCENDING)], unique=True),
        ]
