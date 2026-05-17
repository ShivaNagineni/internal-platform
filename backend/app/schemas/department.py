import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


from app.models.department import LocationType

class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    location: LocationType
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: LocationType = LocationType.ONSHORE


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[LocationType] = None
