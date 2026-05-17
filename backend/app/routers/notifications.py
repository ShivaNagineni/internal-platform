import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.user import User
from app.models.notification import Notification, NotificationType

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    recipient_id: uuid.UUID
    title: str
    message: str
    type: NotificationType
    is_read: bool
    link: str | None
    created_at: datetime


@router.get("/", response_model=list[NotificationOut])
async def get_notifications(current_user: User = Depends(get_current_user)):
    return await Notification.find(Notification.recipient_id == current_user.id).sort(-Notification.created_at).to_list()


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    n = await Notification.get(notification_id)
    if not n or n.recipient_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    await n.save()
    return n


@router.post("/read-all", response_model=dict)
async def mark_all_read(current_user: User = Depends(get_current_user)):
    await Notification.find(Notification.recipient_id == current_user.id, Notification.is_read == False).update(
        {"$set": {"is_read": True}}
    )
    return {"status": "ok"}
