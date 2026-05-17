from __future__ import annotations
import time
import httpx
from datetime import datetime, UTC
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import get_settings

settings = get_settings()
security = HTTPBearer()

_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}
_JWKS_TTL = 86400.0


def _validate_zoho_jwt(token: str) -> dict:
    """Validate a JWT we issued for a Zoho-authenticated user."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("provider") != "zoho":
            raise ValueError("not a zoho token")
        return payload
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def _get_jwks() -> list[dict]:
    now = time.time()
    if now - _jwks_cache["fetched_at"] < _JWKS_TTL and _jwks_cache["keys"]:
        return _jwks_cache["keys"]
    url = f"https://login.microsoftonline.com/{settings.azure_ad_tenant_id}/discovery/v2.0/keys"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    data = resp.json()
    _jwks_cache["keys"] = data["keys"]
    _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


async def _validate_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    keys = await _get_jwks()
    key = next((k for k in keys if k.get("kid") == header.get("kid")), None)
    if not key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Public key not found")

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_iss": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    aud = payload.get("aud")
    valid_audiences = [
        settings.azure_ad_client_id,
        f"api://{settings.azure_ad_client_id}"
    ]
    if aud not in valid_audiences:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid audience")

    iss = payload.get("iss")
    valid_issuers = [
        f"https://login.microsoftonline.com/{settings.azure_ad_tenant_id}/v2.0",
        f"https://sts.windows.net/{settings.azure_ad_tenant_id}/"
    ]
    if iss not in valid_issuers:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid issuer")

    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    from app.models.user import User, UserRole

    token = credentials.credentials

    # ── Zoho JWT (issued by this backend after Zoho OAuth) ────────────────────
    try:
        payload = _validate_zoho_jwt(token)
        import uuid as _uuid
        user = await User.get(_uuid.UUID(payload["sub"]))
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
        return user
    except HTTPException as exc:
        if exc.status_code == 403:
            raise
        # Not a Zoho token — fall through to Azure AD validation

    # ── Azure AD token ────────────────────────────────────────────────────────
    payload = await _validate_token(token)

    azure_oid = payload.get("oid")
    email = payload.get("preferred_username") or payload.get("email") or payload.get("upn") or payload.get("unique_name", "")
    display_name = payload.get("name") or email
    roles_claim: list[str] = payload.get("roles", [])

    if not azure_oid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing oid")

    roles_upper = [r.upper() for r in roles_claim]
    role = UserRole.EMPLOYEE
    if "OWNER" in roles_upper:
        role = UserRole.OWNER
    elif "ADMIN" in roles_upper:
        role = UserRole.ADMIN
    elif "MANAGER" in roles_upper:
        role = UserRole.MANAGER

    user = await User.find_one(User.azure_oid == azure_oid)

    if user is None:
        user = User(azure_oid=azure_oid, email=email, display_name=display_name, role=role)
        await user.insert()
    else:
        user.email = email
        user.display_name = display_name
        if user.role != UserRole.OWNER or role == UserRole.OWNER:
            user.role = role
        user.updated_at = datetime.now(UTC)
        await user.save()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    return user
