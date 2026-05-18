from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class StoryAssignedToOut(BaseModel):
    display_name: str
    unique_name: str


class StoryUserOut(BaseModel):
    id: str
    display_name: str
    email: str


class StoryOut(BaseModel):
    id: int
    project: str
    title: str
    description: str | None
    work_item_type: str
    state: str
    assigned_to: StoryAssignedToOut | None
    assigned_to_platform_user: StoryUserOut | None
    priority: int | None
    created_date: datetime | None
    changed_date: datetime | None
    url: str | None


class StoryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    description: str | None = None
    project: str = Field(..., min_length=1)
    work_item_type: Literal["User Story", "Task", "Bug"] = "User Story"
    assigned_to_email: str | None = None
    priority: int | None = Field(None, ge=1, le=4)
    sprint_path: str | None = None


class StoryUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=256)
    description: str | None = None
    assigned_to_email: str | None = None
    clear_assignee: bool = False
    state: str | None = None
    priority: int | None = Field(None, ge=1, le=4)


class StoryStateUpdate(BaseModel):
    state: str = Field(..., min_length=1)


class StorySprintUpdate(BaseModel):
    sprint_path: str = Field(..., min_length=1)


class SprintStatsOut(BaseModel):
    total: int
    by_state: dict[str, int]
    by_type: dict[str, int]
    done_count: int


class SprintOut(BaseModel):
    id: str
    project: str
    name: str
    path: str
    start_date: datetime | None
    finish_date: datetime | None
    time_frame: str
    stories: list[StoryOut]
    stats: SprintStatsOut
