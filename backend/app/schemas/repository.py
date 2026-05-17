import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class RepositoryOut(BaseModel):
    id: uuid.UUID
    name: str
    github_repo: str
    dev_branch: str
    qa_branch: str
    main_branch: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RepositoryCreate(BaseModel):
    name: str
    github_repo: str
    dev_branch: str = "Development"
    qa_branch: str = "Qa"
    main_branch: str = "main"


class RepositoryUpdate(BaseModel):
    name: Optional[str] = None
    github_repo: Optional[str] = None
    dev_branch: Optional[str] = None
    qa_branch: Optional[str] = None
    main_branch: Optional[str] = None
