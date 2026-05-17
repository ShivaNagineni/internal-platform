import uuid
from datetime import date, datetime, UTC
from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class LeaveType(str, Enum):
    ANNUAL = "ANNUAL"
    SICK = "SICK"
    UNPAID = "UNPAID"
    PARENTAL = "PARENTAL"
    BEREAVEMENT = "BEREAVEMENT"
    WFH = "WFH"


class LeaveStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class Leave(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    leave_type: LeaveType
    status: LeaveStatus = LeaveStatus.PENDING
    start_date: date
    end_date: date
    days: float = 0.0
    reason: str
    approver_id: Optional[uuid.UUID] = None
    approver_comment: Optional[str] = None
    slack_ts: Optional[str] = None
    slack_messages: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "leaves"
        indexes = [
            IndexModel([("user_id", ASCENDING)]),
            IndexModel([("status", ASCENDING), ("start_date", ASCENDING), ("end_date", ASCENDING)]),
        ]
