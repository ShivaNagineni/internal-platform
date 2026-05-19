from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class WikiDocumentOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    category: str
    tags: list[str]
    author_id: uuid.UUID
    author_name: str
    author_email: str
    created_at: datetime
    updated_at: datetime


class WikiDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    category: str = "General"
    tags: list[str] = Field(default_factory=list)


class WikiDocumentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = None
    category: str | None = None
    tags: list[str] | None = None
