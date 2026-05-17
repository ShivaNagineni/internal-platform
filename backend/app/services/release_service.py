import re
import uuid
from fastapi import HTTPException, status

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+].+)?$")


def validate_version(version: str) -> None:
    if not SEMVER_RE.match(version):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Version '{version}' must follow semver (e.g. 1.2.3 or 1.2.3-beta.1)",
        )


async def check_version_unique(version: str, exclude_id: uuid.UUID | None = None) -> None:
    from app.models.release import Release

    filters = [Release.version == version]
    if exclude_id:
        filters.append(Release.id != exclude_id)

    existing = await Release.find_one(*filters)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Release version '{version}' already exists",
        )
