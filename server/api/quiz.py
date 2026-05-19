import json
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import QuizQuestion, QuizRecord, WrongQuestion, MockExam
from models.schemas import QuizAnswerRequest, QuizAnswerResponse
from core.quiz.engine import QuizEngine
from core.spaced_repetition import get_due_reviews, record_review
from core.llm import chat_completion_sync, chat_completion_for_user

logger = logging.getLogger(__name__)
router = APIRouter()
quiz_engine = QuizEngine()


async def _grade_short_answer(question_text: str, reference_answer: str, user_answer: str, user_id: int = None, session: AsyncSession = None) -> dict:
    prompt = f"""请判断以下简答题的答案是否正确。

题目：{question_text}
参考答案：{reference_answer}
学生答案：{user_answer}

请以JSON返回：{{"is_correct": true或false, "score": 0到100的整数, "feedback": "评价"}}
只返回JSON，不要其他内容。"""
    try:
        if user_id and session:
            response = await chat_completion_for_user([{"role": "user", "content": prompt}], user_id, session)
        else:
            response = chat_completion_sync([{"role": "user", "content": prompt}])
        text = response.strip()
        if text.startswith("```"):
            import re
            m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
            if m:
                text = m.group(1).strip()
        result = json.loads(text)
        return {
            "is_correct": bool(result.get("is_correct", False)),
            "score": int(result.get("score", 0)),
            "feedback": str(result.get("feedback", "")),
        }
    except Exception as e:
        logger.error(f"Short answer grading failed: {e}")
        return {"is_correct": False, "score": 0, "feedback": "自动判分失败，请手动检查"}


def _check_answer(question_type: str, selected_answer: str, correct_answer: str) -> bool:
    if question_type == "single_choice":
        return selected_answer.strip().upper() == correct_answer.strip().upper()
    elif question_type == "multiple_choice":
        user_sorted = sorted(a.strip().upper() for a in selected_answer.split(","))
        correct_sorted = sorted(a.strip().upper() for a in correct_answer.split(","))
        return user_sorted == correct_sorted
    elif question_type == "true_false":
        return selected_answer.strip().upper() == correct_answer.strip().upper()
    elif question_type == "fill_blank":
        return selected_answer.strip() == correct_answer.strip()
    else:
        return selected_answer.strip().upper() == correct_answer.strip().upper()


@router.get("/questions")
async def get_questions(
    subject: str = None,
    difficulty: str = None,
    limit: int = 20,
    generate: bool = False,
    count: int = 5,
    user_id: int = None,
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
            user_id=user_id,
            session=session,
        )
        for q_data in new_questions:
            q = QuizQuestion(
                subject=q_data.get("subject", subject or "数学"),
                topic=q_data.get("topic", ""),
                difficulty=q_data.get("difficulty", difficulty or "medium"),
                question_text=q_data["question_text"],
                question_type=q_data.get("question_type", "single_choice"),
                options=q_data.get("options", []),
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
            "question_type": q.question_type or "single_choice",
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
        "question_type": q.question_type or "single_choice",
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
    question_type = request.get("question_type", "single_choice")
    user_id = request.get("user_id")

    new_questions = await quiz_engine.generate_questions(
        subject=subject, topic=topic, difficulty=difficulty, count=count, question_type=question_type,
        user_id=user_id, session=session,
    )
    if not new_questions:
        raise HTTPException(status_code=500, detail="AI 题目生成失败，请稍后重试")

    saved = []
    for q_data in new_questions:
        q = QuizQuestion(
            subject=q_data.get("subject", subject),
            topic=q_data.get("topic", topic),
            difficulty=q_data.get("difficulty", difficulty),
            question_text=q_data["question_text"],
            question_type=q_data.get("question_type", question_type),
            options=q_data.get("options", []),
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
            "question_type": q.question_type or "single_choice",
            "options": q.options or [],
            "answer": q.answer,
            "explanation": q.explanation,
        }
        for q in saved
    ]


@router.post("/adaptive")
async def adaptive_questions(request: dict, session: AsyncSession = Depends(get_session)):
    user_id = request.get("user_id")
    count = min(request.get("count", 5), 10)
    subject = request.get("subject")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    new_questions = await quiz_engine.generate_adaptive_questions(
        user_id=user_id, session=session, count=count, subject=subject
    )
    if not new_questions:
        raise HTTPException(status_code=500, detail="AI 自适应出题失败，请稍后重试")

    saved = []
    for q_data in new_questions:
        q = QuizQuestion(
            subject=q_data.get("subject", subject or "数学"),
            topic=q_data.get("topic", ""),
            difficulty=q_data.get("difficulty", "medium"),
            question_text=q_data["question_text"],
            question_type=q_data.get("question_type", "single_choice"),
            options=q_data.get("options", []),
            answer=q_data["answer"],
            explanation=q_data.get("explanation", ""),
            source="AI自适应",
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
            "question_type": q.question_type or "single_choice",
            "options": q.options or [],
            "explanation": q.explanation or "",
        }
        for q in saved
    ]


@router.post("/answer", response_model=QuizAnswerResponse)
async def submit_answer(request: QuizAnswerRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(QuizQuestion).where(QuizQuestion.id == request.question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    qt = question.question_type or "single_choice"

    if qt == "short_answer":
        grade = await _grade_short_answer(question.question_text, question.answer, request.selected_answer, request.user_id, session)
        is_correct = grade["is_correct"]
    else:
        is_correct = _check_answer(qt, request.selected_answer, question.answer)

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
        select(WrongQuestion, QuizQuestion)
        .join(QuizQuestion, WrongQuestion.question_id == QuizQuestion.id)
        .where(WrongQuestion.user_id == user_id, WrongQuestion.mastered == False)
    )
    rows = result.all()
    items = []
    for w, q in rows:
        items.append({
            "wrong_id": w.id,
            "question_id": q.id,
            "subject": q.subject,
            "question_text": q.question_text,
            "question_type": q.question_type or "single_choice",
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


@router.post("/mock-exam")
async def start_mock_exam(request: dict, session: AsyncSession = Depends(get_session)):
    user_id = request.get("user_id")
    subject = request.get("subject", "数学")
    question_count = min(request.get("question_count", 20), 50)
    duration_minutes = request.get("duration_minutes", 60)

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    new_questions = await quiz_engine.generate_questions(
        subject=subject, difficulty="medium", count=question_count,
        user_id=user_id, session=session,
    )
    if not new_questions:
        raise HTTPException(status_code=500, detail="AI 题目生成失败，请稍后重试")

    saved_questions = []
    for q_data in new_questions:
        q = QuizQuestion(
            subject=q_data.get("subject", subject),
            topic=q_data.get("topic", ""),
            difficulty=q_data.get("difficulty", "medium"),
            question_text=q_data["question_text"],
            question_type=q_data.get("question_type", "single_choice"),
            options=q_data.get("options", []),
            answer=q_data["answer"],
            explanation=q_data.get("explanation", ""),
            source="AI生成-模拟考试",
        )
        session.add(q)
        saved_questions.append(q)

    mock_exam = MockExam(
        user_id=user_id,
        subject=subject,
        total_score=0,
        max_score=float(question_count),
        duration=0,
        question_count=question_count,
        correct_count=0,
    )
    session.add(mock_exam)
    await session.commit()

    for q in saved_questions:
        await session.refresh(q)
    await session.refresh(mock_exam)

    return {
        "exam_id": mock_exam.id,
        "questions": [
            {
                "id": q.id,
                "subject": q.subject,
                "topic": q.topic,
                "difficulty": q.difficulty,
                "question_text": q.question_text,
                "question_type": q.question_type or "single_choice",
                "options": q.options or [],
                "answer": "",
                "explanation": "",
            }
            for q in saved_questions
        ],
        "duration_minutes": duration_minutes,
        "max_score": question_count,
    }


@router.get("/mock-exam/history/{user_id}")
async def get_mock_exam_history(user_id: int, limit: int = 10, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(MockExam)
        .where(MockExam.user_id == user_id)
        .order_by(MockExam.created_at.desc())
        .limit(limit)
    )
    exams = result.scalars().all()
    return [
        {
            "exam_id": e.id,
            "subject": e.subject,
            "total_score": e.total_score,
            "max_score": e.max_score,
            "accuracy": round(e.correct_count / e.question_count * 100, 1) if e.question_count > 0 else 0,
            "duration": e.duration,
            "question_count": e.question_count,
            "correct_count": e.correct_count,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in exams
    ]


@router.post("/mock-exam/{exam_id}/submit")
async def submit_mock_exam(exam_id: int, request: dict, session: AsyncSession = Depends(get_session)):
    answers = request.get("answers", [])
    duration_seconds = request.get("duration_seconds", 0)

    result = await session.execute(select(MockExam).where(MockExam.id == exam_id))
    mock_exam = result.scalar_one_or_none()
    if not mock_exam:
        raise HTTPException(status_code=404, detail="Mock exam not found")

    correct_count = 0
    details = []

    for ans in answers:
        q_id = ans.get("question_id")
        selected = ans.get("selected_answer", "")

        q_result = await session.execute(select(QuizQuestion).where(QuizQuestion.id == q_id))
        question = q_result.scalar_one_or_none()
        if not question:
            continue

        qt = question.question_type or "single_choice"
        if qt == "short_answer":
            grade = await _grade_short_answer(question.question_text, question.answer, selected, mock_exam.user_id, session)
            is_correct = grade["is_correct"]
        else:
            is_correct = _check_answer(qt, selected, question.answer)

        record = QuizRecord(
            user_id=mock_exam.user_id,
            question_id=q_id,
            selected_answer=selected,
            is_correct=is_correct,
        )
        session.add(record)

        if is_correct:
            correct_count += 1
        else:
            existing = await session.execute(
                select(WrongQuestion).where(
                    WrongQuestion.user_id == mock_exam.user_id,
                    WrongQuestion.question_id == q_id,
                )
            )
            if not existing.scalar_one_or_none():
                wrong = WrongQuestion(
                    user_id=mock_exam.user_id,
                    question_id=q_id,
                    next_review_at=datetime.now() + timedelta(days=1),
                )
                session.add(wrong)

        details.append({
            "question_id": q_id,
            "question_text": question.question_text,
            "question_type": qt,
            "selected_answer": selected,
            "correct_answer": question.answer,
            "is_correct": is_correct,
            "explanation": question.explanation or "",
        })

    mock_exam.correct_count = correct_count
    mock_exam.total_score = float(correct_count)
    mock_exam.duration = duration_seconds
    await session.commit()

    question_count = len(answers) or mock_exam.question_count
    accuracy = round((correct_count / question_count) * 100, 1) if question_count > 0 else 0

    return {
        "total_score": correct_count,
        "max_score": mock_exam.max_score,
        "correct_count": correct_count,
        "question_count": question_count,
        "accuracy": accuracy,
        "duration_seconds": duration_seconds,
        "details": details,
    }
