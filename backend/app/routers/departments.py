from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.models.user import User, UserRole
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("/", response_model=list[DepartmentOut])
async def list_departments(current_user: User = Depends(get_current_user)):
    departments = await Department.find().to_list()
    departments.sort(key=lambda d: d.name)
    return departments


@router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    body: DepartmentCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    existing = await Department.find_one(Department.name == body.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
    dept = Department(name=body.name, description=body.description, location=body.location)
    await dept.insert()
    return dept


@router.patch("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: uuid.UUID,
    body: DepartmentUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    dept = await Department.get(dept_id)
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    if body.name is not None and body.name != dept.name:
        existing = await Department.find_one(Department.name == body.name)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
        old_name = dept.name
        dept.name = body.name
        users_to_update = await User.find(User.department == old_name).to_list()
        for user in users_to_update:
            user.department = body.name
            await user.save()

    if body.description is not None:
        dept.description = body.description

    if body.location is not None:
        dept.location = body.location

    await dept.save()
    return dept


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    dept = await Department.get(dept_id)
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    users_to_clear = await User.find(User.department == dept.name).to_list()
    for user in users_to_clear:
        user.department = None
        await user.save()

    await dept.delete()
