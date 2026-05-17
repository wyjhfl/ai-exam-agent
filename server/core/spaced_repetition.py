import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import WrongQuestion, QuizQuestion

logger = logging.getLogger(__name__)


async def get_due_reviews(user_id: int, session: AsyncSession) -> list[dict]:
    now = datetime.now()
    result = await session.execute(
        select(WrongQuestion).where(
            WrongQuestion.user_id == user_id,
            WrongQuestion.mastered == False,
            (WrongQuestion.next_review_at <= now) | (WrongQuestion.next_review_at.is_(None)),
        )
    )
    wrongs = result.scalars().all()
    items = []
    for w in wrongs:
        q_result = await session.execute(select(QuizQuestion).where(QuizQuestion.id == w.question_id))
        q = q_result.scalar_one_or_none()
        if q:
            items.append({
                "wrong_id": w.id,
                "question_id": q.id,
                "subject": q.subject,
                "question_text": q.question_text,
                "options": q.options or [],
                "answer": q.answer,
                "explanation": q.explanation,
                "difficulty": q.difficulty,
                "mastered": w.mastered,
                "next_review_at": w.next_review_at.isoformat() if w.next_review_at else None,
                "interval": w.interval,
            })
    return items


async def record_review(wrong_id: int, is_correct: bool, session: AsyncSession) -> dict:
    result = await session.execute(select(WrongQuestion).where(WrongQuestion.id == wrong_id))
    wrong = result.scalar_one_or_none()
    if not wrong:
        return {"error": "Wrong question not found"}

    wrong.review_count += 1
    wrong.last_reviewed_at = datetime.now()

    if is_correct:
        if wrong.easiness_factor < 3.0:
            wrong.easiness_factor += 0.1
        if wrong.interval == 1:
            wrong.interval = 3
        elif wrong.interval == 3:
            wrong.interval = 7
        elif wrong.interval == 7:
            wrong.interval = 15
        elif wrong.interval == 15:
            wrong.interval = 30
        else:
            wrong.interval = int(wrong.interval * wrong.easiness_factor)

        if wrong.interval >= 60:
            wrong.mastered = True
    else:
        wrong.easiness_factor = max(1.3, wrong.easiness_factor - 0.2)
        wrong.interval = 1

    wrong.next_review_at = datetime.now() + timedelta(days=wrong.interval)
    await session.commit()

    return {
        "is_correct": is_correct,
        "next_interval": wrong.interval,
        "next_review_at": wrong.next_review_at.isoformat(),
        "mastered": wrong.mastered,
    }
