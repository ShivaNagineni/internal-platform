from __future__ import annotations

from datetime import datetime, UTC, timedelta

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from jose import jwt

from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

_ZOHO_AUTH_URL = "https://accounts.zoho.com/oauth/v2/auth"
_ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"
_ZOHO_USERINFO_URL = "https://accounts.zoho.com/oauth/v2/userinfo"
_SCOPES = "openid profile email"


class ZohoExchangeRequest(BaseModel):
    code: str


class ZohoExchangeResponse(BaseModel):
    access_token: str
    user: dict


@router.get("/zoho")
async def zoho_login_url():
    """Return the Zoho OAuth authorization URL for the frontend to redirect to."""
    settings = get_settings()
    if not settings.zoho_client_id:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Zoho OAuth not configured")
    url = (
        f"{_ZOHO_AUTH_URL}"
        f"?response_type=code"
        f"&client_id={settings.zoho_client_id}"
        f"&scope={_SCOPES.replace(' ', '+')}"
        f"&redirect_uri={settings.zoho_redirect_uri}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return {"url": url}


@router.post("/zoho/exchange", response_model=ZohoExchangeResponse)
async def zoho_exchange(body: ZohoExchangeRequest):
    """Exchange a Zoho OAuth code for our own session JWT."""
    settings = get_settings()
    if not settings.zoho_client_id or not settings.zoho_client_secret:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Zoho OAuth not configured")

    # Exchange code for Zoho access token
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            _ZOHO_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.zoho_client_id,
                "client_secret": settings.zoho_client_secret,
                "redirect_uri": settings.zoho_redirect_uri,
                "code": body.code,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to exchange Zoho code")

        token_data = token_resp.json()
        zoho_access_token = token_data.get("access_token")
        if not zoho_access_token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No access_token in Zoho response")

        # Fetch user info from Zoho
        info_resp = await client.get(
            _ZOHO_USERINFO_URL,
            headers={"Authorization": f"Zoho-oauthtoken {zoho_access_token}"},
        )
        if info_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch Zoho user info")

        info = info_resp.json()

    zoho_uid = info.get("sub") or info.get("ZUID")
    email = info.get("email", "")
    display_name = info.get("name") or info.get("display_name") or email

    if not zoho_uid or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zoho user info incomplete")

    # Find or create the user in MongoDB
    from app.models.user import User, UserRole

    user = await User.find_one(User.zoho_uid == zoho_uid)
    if user is None:
        # Check if an Azure AD user already exists with this email (link accounts)
        user = await User.find_one(User.email == email)
        if user:
            user.zoho_uid = zoho_uid
            user.updated_at = datetime.now(UTC)
            await user.save()
        else:
            user = User(zoho_uid=zoho_uid, email=email, display_name=display_name, role=UserRole.EMPLOYEE)
            await user.insert()
    else:
        user.email = email
        user.display_name = display_name
        user.updated_at = datetime.now(UTC)
        await user.save()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    # Issue our own short-lived JWT so the frontend can call the API
    now = datetime.now(UTC)
    our_jwt = jwt.encode(
        {
            "sub": str(user.id),
            "email": user.email,
            "provider": "zoho",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=8)).timestamp()),
        },
        settings.secret_key,
        algorithm="HS256",
    )

    return ZohoExchangeResponse(
        access_token=our_jwt,
        user={
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role.value,
        },
    )
