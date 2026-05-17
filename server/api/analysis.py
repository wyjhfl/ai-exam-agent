import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from db.database import get_session
from db.models import QuizRecord, WrongQuestion, StudySession, QuizQuestion

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{user_id}/overview")
async def get_overview(user_id: int, session: AsyncSession = Depends(get_session)):
    total_study = await session.execute(
        select(func.coalesce(func.sum(StudySession.duration), 0)).where(StudySession.user_id == user_id)
    )
    total_study_minutes = total_study.scalar() or 0

    total_quiz = await session.execute(
        select(func.count()).where(QuizRecord.user_id == user_id)
    )
    total_quiz_count = total_quiz.scalar() or 0

    correct_count = await session.execute(
        select(func.count()).where(QuizRecord.user_id == user_id, QuizRecord.is_correct == True)
    )
    correct = correct_count.scalar() or 0

    wrong_count = await session.execute(
        select(func.count()).where(WrongQuestion.user_id == user_id, WrongQuestion.mastered == False)
    )
    wrong = wrong_count.scalar() or 0

    accuracy = round(correct / total_quiz_count * 100, 1) if total_quiz_count > 0 else 0

    return {
        "total_study_minutes": total_study_minutes,
        "total_quiz_count": total_quiz_count,
        "accuracy": accuracy,
        "wrong_count": wrong,
    }


@router.get("/{user_id}/subject-stats")
async def get_subject_stats(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(
            QuizQuestion.subject,
            func.count().label("total"),
            func.sum(case((QuizRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(QuizQuestion, QuizRecord.question_id == QuizQuestion.id)
        .where(QuizRecord.user_id == user_id)
        .group_by(QuizQuestion.subject)
    )
    rows = result.all()
    stats = []
    for row in rows:
        total = row.total or 0
        correct = row.correct or 0
        stats.append({
            "subject": row.subject,
            "total": total,
            "correct": correct,
            "accuracy": round(correct / total * 100, 1) if total > 0 else 0,
        })
    return stats


@router.get("/{user_id}/trend")
async def get_trend(user_id: int, days: int = 7, session: AsyncSession = Depends(get_session)):
    trend = []
    for i in range(days - 1, -1, -1):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        next_date = (datetime.now() - timedelta(days=i - 1)).strftime("%Y-%m-%d") if i > 0 else (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        day_total = await session.execute(
            select(func.count()).where(
                QuizRecord.user_id == user_id,
                QuizRecord.created_at >= date,
                QuizRecord.created_at < next_date,
            )
        )
        total = day_total.scalar() or 0

        day_correct = await session.execute(
            select(func.count()).where(
                QuizRecord.user_id == user_id,
                QuizRecord.is_correct == True,
                QuizRecord.created_at >= date,
                QuizRecord.created_at < next_date,
            )
        )
        correct = day_correct.scalar() or 0

        trend.append({
            "date": date,
            "total": total,
            "correct": correct,
            "accuracy": round(correct / total * 100, 1) if total > 0 else 0,
        })
    return trend
