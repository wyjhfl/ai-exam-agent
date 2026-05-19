import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from db.database import get_session
from db.models import QuizRecord, WrongQuestion, StudySession, QuizQuestion, User
from core.llm import chat_completion_sync, is_configured

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


@router.get("/{user_id}/weak-points")
async def get_weak_points(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(
            QuizQuestion.topic,
            QuizQuestion.subject,
            func.count().label("total"),
            func.sum(case((QuizRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(QuizQuestion, QuizRecord.question_id == QuizQuestion.id)
        .where(QuizRecord.user_id == user_id, QuizQuestion.topic != None, QuizQuestion.topic != "")
        .group_by(QuizQuestion.topic, QuizQuestion.subject)
    )
    rows = result.all()
    points = []
    for row in rows:
        total = row.total or 0
        correct = row.correct or 0
        accuracy = round(correct / total * 100, 1) if total > 0 else 0
        points.append({
            "topic": row.topic,
            "subject": row.subject,
            "total": total,
            "correct": correct,
            "accuracy": accuracy,
        })
    points.sort(key=lambda x: x["accuracy"])
    return points[:5]


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


@router.get("/{user_id}/weekly-report")
async def get_weekly_report(user_id: int, session: AsyncSession = Depends(get_session)):
    now = datetime.now()
    week_ago = now - timedelta(days=7)
    period_start = week_ago.strftime("%Y-%m-%d")
    period_end = now.strftime("%Y-%m-%d")

    total_quiz_result = await session.execute(
        select(func.count()).where(
            QuizRecord.user_id == user_id,
            QuizRecord.created_at >= week_ago,
        )
    )
    total_quiz = total_quiz_result.scalar() or 0

    correct_result = await session.execute(
        select(func.count()).where(
            QuizRecord.user_id == user_id,
            QuizRecord.is_correct == True,
            QuizRecord.created_at >= week_ago,
        )
    )
    correct_count = correct_result.scalar() or 0
    accuracy = round(correct_count / total_quiz * 100, 1) if total_quiz > 0 else 0

    subject_result = await session.execute(
        select(
            QuizQuestion.subject,
            func.count().label("total"),
            func.sum(case((QuizRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(QuizQuestion, QuizRecord.question_id == QuizQuestion.id)
        .where(QuizRecord.user_id == user_id, QuizRecord.created_at >= week_ago)
        .group_by(QuizQuestion.subject)
    )
    subject_rows = subject_result.all()
    subject_stats = []
    subject_details_parts = []
    for row in subject_rows:
        total = row.total or 0
        correct = row.correct or 0
        acc = round(correct / total * 100, 1) if total > 0 else 0
        subject_stats.append({
            "subject": row.subject,
            "total": total,
            "correct": correct,
            "accuracy": acc,
        })
        subject_details_parts.append(f"{row.subject}({total}道,正确率{acc}%)")
    subject_details = "; ".join(subject_details_parts) if subject_details_parts else "暂无"

    study_result = await session.execute(
        select(func.coalesce(func.sum(StudySession.duration), 0)).where(
            StudySession.user_id == user_id,
            StudySession.created_at >= week_ago,
        )
    )
    total_study_minutes = study_result.scalar() or 0
    total_hours = round(total_study_minutes / 60, 1)

    new_wrong_result = await session.execute(
        select(func.count()).where(
            WrongQuestion.user_id == user_id,
            WrongQuestion.created_at >= week_ago,
        )
    )
    new_wrong = new_wrong_result.scalar() or 0

    mastered_result = await session.execute(
        select(func.count()).where(
            WrongQuestion.user_id == user_id,
            WrongQuestion.mastered == True,
            WrongQuestion.created_at >= week_ago,
        )
    )
    mastered = mastered_result.scalar() or 0

    weak_result = await session.execute(
        select(
            QuizQuestion.topic,
            QuizQuestion.subject,
            func.count().label("total"),
            func.sum(case((QuizRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(QuizQuestion, QuizRecord.question_id == QuizQuestion.id)
        .where(
            QuizRecord.user_id == user_id,
            QuizRecord.created_at >= week_ago,
            QuizQuestion.topic != None,
            QuizQuestion.topic != "",
        )
        .group_by(QuizQuestion.topic, QuizQuestion.subject)
    )
    weak_rows = weak_result.all()
    weak_points_list = []
    for row in weak_rows:
        total = row.total or 0
        correct = row.correct or 0
        acc = round(correct / total * 100, 1) if total > 0 else 0
        weak_points_list.append({
            "topic": row.topic,
            "subject": row.subject,
            "total": total,
            "correct": correct,
            "accuracy": acc,
        })
    weak_points_list.sort(key=lambda x: x["accuracy"])
    weak_topics = weak_points_list[:3]
    weak_topics_str = ", ".join(f"{w['topic']}({w['subject']},{w['accuracy']}%)" for w in weak_topics) if weak_topics else "暂无明显薄弱点"

    summary = ""
    suggestions = []
    next_focus = ""

    if is_configured():
        prompt = f"""请根据以下学习数据生成一份简洁的周报。

本周数据：
- 刷题总数：{total_quiz}道
- 正确率：{accuracy}%
- 各科：{subject_details}
- 学习时长：{total_hours}小时
- 新增错题：{new_wrong}道
- 已掌握错题：{mastered}道
- 薄弱知识点：{weak_topics_str}

请严格按以下格式输出（每行一个字段，用|||分隔）：
一句话总结|||建议1|||建议2|||建议3|||下周重点复习方向"""
        try:
            llm_response = chat_completion_sync([{"role": "user", "content": prompt}])
            parts = llm_response.split("|||")
            if len(parts) >= 5:
                summary = parts[0].strip()
                suggestions = [parts[1].strip(), parts[2].strip(), parts[3].strip()]
                next_focus = parts[4].strip()
            else:
                summary = llm_response.strip()[:100]
                suggestions = ["继续坚持每日刷题", "重点复习薄弱知识点", "保持良好学习节奏"]
                next_focus = "巩固薄弱知识点"
        except Exception as e:
            logger.warning(f"LLM weekly report generation failed: {e}")
            summary = f"本周共刷题{total_quiz}道，正确率{accuracy}%"
            suggestions = ["继续坚持每日刷题", "重点复习薄弱知识点", "保持良好学习节奏"]
            next_focus = "巩固薄弱知识点"
    else:
        summary = f"本周共刷题{total_quiz}道，正确率{accuracy}%，学习时长{total_hours}小时"
        suggestions = ["继续坚持每日刷题", "重点复习薄弱知识点", "保持良好学习节奏"]
        next_focus = weak_topics[0]["topic"] if weak_topics else "巩固基础知识"

    return {
        "period": f"{period_start} ~ {period_end}",
        "stats": {
            "total_quiz": total_quiz,
            "accuracy": accuracy,
            "study_hours": total_hours,
            "new_wrong": new_wrong,
            "mastered": mastered,
        },
        "subject_stats": subject_stats,
        "weak_topics": weak_topics,
        "summary": summary,
        "suggestions": suggestions,
        "next_focus": next_focus,
    }
