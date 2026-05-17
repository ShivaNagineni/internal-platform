import uuid
from datetime import date, datetime
from pydantic import BaseModel, field_validator
from app.models.leave import LeaveType, LeaveStatus
from app.models.user import UserRole


class LeaveCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


class LeaveUpdate(BaseModel):
    status: LeaveStatus | None = None
    approver_comment: str | None = None
    leave_type: LeaveType | None = None
    start_date: date | None = None
    end_date: date | None = None
    reason: str | None = None


class LeaveUserOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str
    department: str | None
    role: UserRole

    model_config = {"from_attributes": True}


class LeaveOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user: LeaveUserOut
    leave_type: LeaveType
    status: LeaveStatus
    start_date: date
    end_date: date
    days: float
    reason: str
    approver_id: uuid.UUID | None
    approver: LeaveUserOut | None
    approver_comment: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WhoIsOutEntry(BaseModel):
    user: LeaveUserOut
    leave_type: LeaveType
    start_date: date
    end_date: date
    days: float

    model_config = {"from_attributes": True}
