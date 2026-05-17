import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.idea import IdeaStatus, IdeaCategory


class IdeaCreate(BaseModel):
    title: str
    description: str
    category: IdeaCategory = IdeaCategory.OTHER


class IdeaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: IdeaCategory | None = None
    status: IdeaStatus | None = None


class IdeaAuthorOut(BaseModel):
    id: uuid.UUID
    azure_oid: str
    display_name: str
    email: str
    department: str | None

    model_config = {"from_attributes": True}


class IdeaOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    author_id: uuid.UUID
    author: IdeaAuthorOut
    status: IdeaStatus
    category: IdeaCategory
    upvote_count: int
    voted_by_me: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
