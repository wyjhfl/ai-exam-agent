import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from db.database import get_session
from db.models import QuizQuestion, ChatHistory, UserUpload, User
from core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _make_snippet(text: str, keyword: str, max_len: int = 100) -> str:
    if not text or not keyword:
        return (text or "")[:max_len]
    lower_text = text.lower()
    lower_kw = keyword.lower()
    idx = lower_text.find(lower_kw)
    if idx == -1:
        return text[:max_len]
    start = max(0, idx - 30)
    end = min(len(text), idx + len(keyword) + 70)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet[:max_len + 10]


@router.get("")
async def global_search(
    q: str,
    type: str = "all",
    page: int = 1,
    page_size: int = 20,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id
    if not q or len(q.strip()) < 1:
        return {"results": [], "total": 0, "page": page, "page_size": page_size}

    keyword = q.strip()
    offset = (page - 1) * page_size
    results = []

    if type in ("all", "questions"):
        query = (
            select(QuizQuestion)
            .where(
                or_(
                    QuizQuestion.question_text.ilike(f"%{keyword}%"),
                    QuizQuestion.topic.ilike(f"%{keyword}%"),
                    QuizQuestion.subject.ilike(f"%{keyword}%"),
                )
            )
            .order_by(QuizQuestion.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = (await session.execute(query)).scalars().all()
        for r in rows:
            results.append({
                "type": "question",
                "title": r.question_text[:80],
                "snippet": _make_snippet(r.question_text, keyword),
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

    if type in ("all", "chats"):
        query = (
            select(ChatHistory)
            .where(
                ChatHistory.user_id == user_id,
                ChatHistory.content.ilike(f"%{keyword}%"),
            )
            .order_by(ChatHistory.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = (await session.execute(query)).scalars().all()
        for r in rows:
            results.append({
                "type": "chat",
                "title": r.content[:80],
                "snippet": _make_snippet(r.content, keyword),
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

    if type in ("all", "materials"):
        query = (
            select(UserUpload)
            .where(
                UserUpload.user_id == user_id,
                or_(
                    UserUpload.filename.ilike(f"%{keyword}%"),
                ),
            )
            .order_by(UserUpload.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = (await session.execute(query)).scalars().all()
        for r in rows:
            results.append({
                "type": "material",
                "title": r.filename,
                "snippet": _make_snippet(r.filename, keyword),
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

    return {"results": results, "total": len(results), "page": page, "page_size": page_size}
