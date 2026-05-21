import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import ChatHistory, User
from core.auth import get_current_user
from core.writing_evaluator import WritingEvaluator
from models.schemas import WritingEvaluateRequest

logger = logging.getLogger(__name__)
router = APIRouter()
evaluator = WritingEvaluator()


@router.post("/evaluate")
async def evaluate_writing(request: WritingEvaluateRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    text = request.text
    essay_type = request.essay_type
    user_id = current_user.id

    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="作文内容太短，至少需要50字")

    result = await evaluator.evaluate_essay(text, essay_type, user_id=user_id, session=session)

    history = ChatHistory(
        user_id=user_id,
        role="assistant",
        content=f"[作文批改] {essay_type} | 得分: {result['score']}/{result['max_score']}\n\n{text[:200]}",
        sources=[{"type": "writing_evaluation", "score": result["score"], "max_score": result["max_score"], "result": result}],
    )
    session.add(history)
    await session.commit()

    return result


@router.get("/history")
async def get_writing_history(limit: int = 5, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    result = await session.execute(
        select(ChatHistory)
        .where(ChatHistory.user_id == user_id, ChatHistory.content.like("[作文批改]%"))
        .order_by(ChatHistory.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    items = []
    for r in records:
        evaluation = {}
        if r.sources and isinstance(r.sources, list) and len(r.sources) > 0:
            evaluation = r.sources[0].get("result", {})
        items.append({
            "id": r.id,
            "score": evaluation.get("score", 0),
            "max_score": evaluation.get("max_score", 0),
            "feedback": evaluation.get("structure_feedback", ""),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return items
