import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserOut(BaseModel):
    id: uuid.UUID
    azure_oid: str | None = None
    zoho_uid: str | None = None
    email: str
    display_name: str
    department: str | None
    role: UserRole
    theme: str
    is_active: bool
    points: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = None
    department: str | None = None
    theme: str | None = None


class UserRoleUpdate(BaseModel):
    role: UserRole
