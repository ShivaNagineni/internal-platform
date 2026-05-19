from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.models.user import User, UserRole
from app.models.wiki import WikiDocument
from app.schemas.wiki import WikiDocumentCreate, WikiDocumentOut, WikiDocumentUpdate
from app.services import ado_wiki_service as ado_wiki

router = APIRouter(prefix="/wiki", tags=["wiki"])

MANAGER_ROLES = {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}


# ─── Azure DevOps Wiki ────────────────────────────────────────────────────────

@router.get("/ado/pages", response_model=list[dict])
async def list_ado_wiki_pages(current_user: User = Depends(get_current_user)):
    try:
        return await ado_wiki.list_all_ado_wiki_pages()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.get("/ado/page-content")
async def get_ado_wiki_page_content(
    project: str = Query(...),
    wiki_id: str = Query(...),
    path: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        content = await ado_wiki.get_ado_wiki_page_content(project, wiki_id, path)
        return {"content": content}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


def _out(doc: WikiDocument) -> WikiDocumentOut:
    return WikiDocumentOut(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        category=doc.category,
        tags=doc.tags,
        author_id=doc.author_id,
        author_name=doc.author_name,
        author_email=doc.author_email,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.get("/", response_model=list[WikiDocumentOut])
async def list_wiki(
    search: str | None = Query(None),
    category: str | None = Query(None),
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if category:
        query["category"] = category
    docs = await WikiDocument.find(query).sort(-WikiDocument.updated_at).to_list()
    if search:
        q = search.lower()
        docs = [d for d in docs if q in d.title.lower() or q in d.content.lower()]
    return [_out(d) for d in docs]


@router.get("/categories", response_model=list[str])
async def list_categories(current_user: User = Depends(get_current_user)):
    docs = await WikiDocument.find_all().to_list()
    return sorted({d.category for d in docs})


@router.get("/{doc_id}", response_model=WikiDocumentOut)
async def get_wiki(doc_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    doc = await WikiDocument.get(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return _out(doc)


@router.post("/", response_model=WikiDocumentOut, status_code=status.HTTP_201_CREATED)
async def create_wiki(payload: WikiDocumentCreate, current_user: User = Depends(get_current_user)):
    doc = WikiDocument(
        title=payload.title,
        content=payload.content,
        category=payload.category,
        tags=payload.tags,
        author_id=current_user.id,
        author_name=current_user.display_name,
        author_email=current_user.email,
    )
    await doc.insert()
    return _out(doc)


@router.patch("/{doc_id}", response_model=WikiDocumentOut)
async def update_wiki(
    doc_id: uuid.UUID,
    payload: WikiDocumentUpdate,
    current_user: User = Depends(get_current_user),
):
    doc = await WikiDocument.get(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    is_manager_plus = current_user.role in MANAGER_ROLES
    is_author = doc.author_id == current_user.id
    if not is_author and not is_manager_plus:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author or a manager can edit this document")

    from datetime import datetime, UTC
    if payload.title is not None:
        doc.title = payload.title
    if payload.content is not None:
        doc.content = payload.content
    if payload.category is not None:
        doc.category = payload.category
    if payload.tags is not None:
        doc.tags = payload.tags
    doc.updated_at = datetime.now(UTC)
    await doc.save()
    return _out(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wiki(doc_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    doc = await WikiDocument.get(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    is_manager_plus = current_user.role in MANAGER_ROLES
    is_author = doc.author_id == current_user.id
    if not is_author and not is_manager_plus:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author or a manager can delete this document")

    await doc.delete()
