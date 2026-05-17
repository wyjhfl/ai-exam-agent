import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import QuizQuestion, QuizRecord, WrongQuestion
from models.schemas import QuizAnswerRequest, QuizAnswerResponse
from core.quiz.engine import QuizEngine
from core.spaced_repetition import get_due_reviews, record_review

logger = logging.getLogger(__name__)
router = APIRouter()
quiz_engine = QuizEngine()


@router.get("/questions")
async def get_questions(
    subject: str = None,
    difficulty: str = None,
    limit: int = 20,
    generate: bool = False,
    count: int = 5,
    session: AsyncSession = Depends(get_session),
):
    query = select(QuizQuestion)
    if subject:
        query = query.where(QuizQuestion.subject == subject)
    if difficulty:
        query = query.where(QuizQuestion.difficulty == difficulty)
    result = await session.execute(query.limit(limit))
    questions = result.scalars().all()

    if generate and len(questions) < count:
        needed = count - len(questions)
        new_questions = await quiz_engine.generate_questions(
            subject=subject or "数学",
            difficulty=difficulty or "medium",
            count=needed,
        )
        for q_data in new_questions:
            q = QuizQuestion(
                subject=q_data.get("subject", subject or "数学"),
                topic=q_data.get("topic", ""),
                difficulty=q_data.get("difficulty", difficulty or "medium"),
                question_text=q_data["question_text"],
                options=q_data["options"],
                answer=q_data["answer"],
                explanation=q_data.get("explanation", ""),
                source="AI生成",
            )
            session.add(q)
            questions.append(q)
        await session.commit()
        for q in questions:
            await session.refresh(q)

    return [
        {
            "id": q.id,
            "subject": q.subject,
            "topic": q.topic,
            "difficulty": q.difficulty,
            "question_text": q.question_text,
            "options": q.options or [],
            "answer": q.answer,
            "explanation": q.explanation,
        }
        for q in questions
    ]


@router.get("/questions/{question_id}")
async def get_question(question_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "id": q.id,
        "subject": q.subject,
        "topic": q.topic,
        "difficulty": q.difficulty,
        "question_text": q.question_text,
        "options": q.options or [],
        "answer": q.answer,
        "explanation": q.explanation,
    }


@router.post("/generate")
async def generate_questions(request: dict, session: AsyncSession = Depends(get_session)):
    subject = request.get("subject", "数学")
    topic = request.get("topic", "")
    difficulty = request.get("difficulty", "medium")
    count = min(request.get("count", 5), 10)

    new_questions = await quiz_engine.generate_questions(subject=subject, topic=topic, difficulty=difficulty, count=count)
    if not new_questions:
        raise HTTPException(status_code=500, detail="AI 题目生成失败，请稍后重试")

    saved = []
    for q_data in new_questions:
        q = QuizQuestion(
            subject=q_data.get("subject", subject),
            topic=q_data.get("topic", topic),
            difficulty=q_data.get("difficulty", difficulty),
            question_text=q_data["question_text"],
            options=q_data["options"],
            answer=q_data["answer"],
            explanation=q_data.get("explanation", ""),
            source="AI生成",
        )
        session.add(q)
        saved.append(q)

    await session.commit()
    for q in saved:
        await session.refresh(q)

    return [
        {
            "id": q.id,
            "subject": q.subject,
            "topic": q.topic,
            "difficulty": q.difficulty,
            "question_text": q.question_text,
            "options": q.options or [],
            "answer": q.answer,
            "explanation": q.explanation,
        }
        for q in saved
    ]


@router.post("/answer", response_model=QuizAnswerResponse)
async def submit_answer(request: QuizAnswerRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(QuizQuestion).where(QuizQuestion.id == request.question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct = request.selected_answer.strip().upper() == question.answer.strip().upper()

    record = QuizRecord(
        user_id=request.user_id,
        question_id=request.question_id,
        selected_answer=request.selected_answer,
        is_correct=is_correct,
    )
    session.add(record)

    if not is_correct:
        existing = await session.execute(
            select(WrongQuestion).where(
                WrongQuestion.user_id == request.user_id,
                WrongQuestion.question_id == request.question_id,
            )
        )
        if not existing.scalar_one_or_none():
            from datetime import datetime, timedelta
            wrong = WrongQuestion(
                user_id=request.user_id,
                question_id=request.question_id,
                next_review_at=datetime.now() + timedelta(days=1),
            )
            session.add(wrong)

    await session.commit()

    return QuizAnswerResponse(
        is_correct=is_correct,
        correct_answer=question.answer,
        explanation=question.explanation or "",
    )


@router.get("/wrong/{user_id}")
async def get_wrong_questions(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(WrongQuestion).where(WrongQuestion.user_id == user_id, WrongQuestion.mastered == False)
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
            })
    return items


@router.post("/wrong/{wrong_id}/master")
async def mark_wrong_mastered(wrong_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(WrongQuestion).where(WrongQuestion.id == wrong_id))
    wrong = result.scalar_one_or_none()
    if not wrong:
        raise HTTPException(status_code=404, detail="Wrong question record not found")
    wrong.mastered = True
    await session.commit()
    return {"status": "ok", "wrong_id": wrong_id, "mastered": True}


@router.get("/review/{user_id}")
async def get_review_questions(user_id: int, session: AsyncSession = Depends(get_session)):
    return await get_due_reviews(user_id, session)


@router.post("/review/{wrong_id}/answer")
async def submit_review_answer(wrong_id: int, request: dict, session: AsyncSession = Depends(get_session)):
    is_correct = request.get("is_correct", False)
    result = await record_review(wrong_id, is_correct, session)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
