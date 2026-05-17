from fastapi import Depends, HTTPException, status
from app.models.user import User, UserRole
from app.core.auth import get_current_user

_ROLE_RANK = {UserRole.EMPLOYEE: 0, UserRole.MANAGER: 1, UserRole.ADMIN: 2, UserRole.OWNER: 3}


async def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if _ROLE_RANK[current_user.role] < _ROLE_RANK[UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager, Admin, or Owner role required",
        )
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Owner role required",
        )
    return current_user
