import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from app.models.release import ReleaseStatus, ReleaseStatusEntry
from app.schemas.repository import RepositoryOut


class ReleaseCreate(BaseModel):
    title: str
    version: str
    description: str | None = None
    release_date: date | None = None
    repository_ids: list[uuid.UUID] | None = None


class ReleaseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    release_date: date | None = None
    status: ReleaseStatus | None = None
    changelog: str | None = None
    repository_ids: list[uuid.UUID] | None = None


class ReleaseOwnerOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str

    model_config = {"from_attributes": True}


class ReleaseOut(BaseModel):
    id: uuid.UUID
    title: str
    version: str
    description: str | None
    release_date: date | None
    status: ReleaseStatus
    status_history: list[ReleaseStatusEntry]
    owner_id: uuid.UUID | None
    owner: ReleaseOwnerOut | None
    repository_ids: list[uuid.UUID] | None = None
    repositories: list[RepositoryOut] | None = None
    changelog: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
