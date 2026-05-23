import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_session
from db.models import ExamPaper, ExamQuestion, User
from core.auth import get_current_user
from api.quiz import _check_answer, _grade_short_answer
from models.schemas import ExamPaperCreate, ExamQuestionCreate, ExamPaperImport, ExamSubmitRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_exam_papers(
    subject: str = None,
    year: int = None,
    page: int = 1,
    page_size: int = 20,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(ExamPaper)
    count_query = select(func.count(ExamPaper.id))

    if subject:
        query = query.where(ExamPaper.subject == subject)
        count_query = count_query.where(ExamPaper.subject == subject)
    if year:
        query = query.where(ExamPaper.year == year)
        count_query = count_query.where(ExamPaper.year == year)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(ExamPaper.year.desc()).offset(offset).limit(page_size)
    result = await session.execute(query)
    papers = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": p.id,
                "title": p.title,
                "subject": p.subject,
                "year": p.year,
                "exam_type": p.exam_type,
                "question_count": p.question_count,
                "total_score": p.total_score,
                "duration_minutes": p.duration_minutes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in papers
        ],
    }


@router.get("/{paper_id}")
async def get_exam_paper(paper_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Exam paper not found")

    q_result = await session.execute(
        select(ExamQuestion)
        .where(ExamQuestion.paper_id == paper_id)
        .order_by(ExamQuestion.question_order)
    )
    questions = q_result.scalars().all()

    return {
        "id": paper.id,
        "title": paper.title,
        "subject": paper.subject,
        "year": paper.year,
        "exam_type": paper.exam_type,
        "description": paper.description,
        "question_count": paper.question_count,
        "total_score": paper.total_score,
        "duration_minutes": paper.duration_minutes,
        "created_at": paper.created_at.isoformat() if paper.created_at else None,
        "questions": [
            {
                "id": q.id,
                "section_name": q.section_name,
                "question_order": q.question_order,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options or [],
                "answer": q.answer,
                "explanation": q.explanation,
                "score": q.score,
                "topic": q.topic,
            }
            for q in questions
        ],
    }


@router.post("")
async def create_exam_paper(request: ExamPaperCreate, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    title = request.title
    subject = request.subject
    year = request.year
    if not title or not subject or not year:
        raise HTTPException(status_code=400, detail="title, subject, year are required")

    paper = ExamPaper(
        title=title,
        subject=subject,
        year=year,
        exam_type=request.exam_type,
        description=request.description,
        total_score=request.total_score,
        duration_minutes=request.duration_minutes,
    )
    session.add(paper)
    await session.commit()
    await session.refresh(paper)

    return {
        "id": paper.id,
        "title": paper.title,
        "subject": paper.subject,
        "year": paper.year,
        "exam_type": paper.exam_type,
        "question_count": paper.question_count,
        "total_score": paper.total_score,
        "duration_minutes": paper.duration_minutes,
    }


@router.post("/{paper_id}/questions")
async def add_question_to_paper(
    paper_id: int, request: ExamQuestionCreate, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)
):
    result = await session.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Exam paper not found")

    question_text = request.question_text
    question_order = request.question_order
    if not question_text or question_order is None:
        raise HTTPException(status_code=400, detail="question_text and question_order are required")

    question = ExamQuestion(
        paper_id=paper_id,
        section_name=request.section_name,
        question_order=question_order,
        question_text=question_text,
        question_type=request.question_type,
        options=request.options,
        answer=request.answer,
        explanation=request.explanation,
        score=request.score,
        topic=request.topic,
    )
    session.add(question)

    paper.question_count = (paper.question_count or 0) + 1
    await session.commit()
    await session.refresh(question)

    return {
        "id": question.id,
        "paper_id": question.paper_id,
        "section_name": question.section_name,
        "question_order": question.question_order,
        "question_type": question.question_type,
        "score": question.score,
    }


@router.post("/import")
async def import_exam(request: ExamPaperImport, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    from core.exam_loader import load_exam_from_json

    json_data = request.model_dump()
    try:
        paper, questions = load_exam_from_json(json_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = await session.execute(
        select(ExamPaper).where(ExamPaper.title == paper.title)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Exam paper '{paper.title}' already exists")

    session.add(paper)
    await session.flush()

    for q in questions:
        q.paper_id = paper.id
        session.add(q)

    paper.question_count = len(questions)
    await session.commit()
    await session.refresh(paper)

    return {
        "paper_id": paper.id,
        "title": paper.title,
        "question_count": paper.question_count,
    }


@router.delete("/{paper_id}")
async def delete_exam_paper(paper_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Exam paper not found")

    await session.delete(paper)
    await session.commit()
    return {"status": "ok", "deleted_paper_id": paper_id}


@router.post("/{paper_id}/start")
async def start_exam(paper_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Exam paper not found")

    q_result = await session.execute(
        select(ExamQuestion)
        .where(ExamQuestion.paper_id == paper_id)
        .order_by(ExamQuestion.question_order)
    )
    questions = q_result.scalars().all()

    return {
        "id": paper.id,
        "title": paper.title,
        "subject": paper.subject,
        "year": paper.year,
        "exam_type": paper.exam_type,
        "total_score": paper.total_score,
        "duration_minutes": paper.duration_minutes,
        "questions": [
            {
                "id": q.id,
                "section_name": q.section_name,
                "question_order": q.question_order,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options or [],
                "score": q.score,
                "topic": q.topic,
            }
            for q in questions
        ],
    }


@router.post("/{paper_id}/submit")
async def submit_exam(
    paper_id: int, request: ExamSubmitRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)
):
    result = await session.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Exam paper not found")

    answers = request.answers
    if not answers:
        raise HTTPException(status_code=400, detail="answers are required")

    q_result = await session.execute(
        select(ExamQuestion)
        .where(ExamQuestion.paper_id == paper_id)
        .order_by(ExamQuestion.question_order)
    )
    all_questions = q_result.scalars().all()
    question_map = {q.id: q for q in all_questions}

    total_score = 0.0
    max_score = 0.0
    details = []

    for ans in answers:
        q_id = ans.get("question_id")
        selected = ans.get("selected_answer", "")
        question = question_map.get(q_id)
        if not question:
            continue

        q_score = question.score or 0
        max_score += q_score

        qt = question.question_type or "single_choice"
        if qt == "short_answer":
            grade = await _grade_short_answer(
                question.question_text, question.answer or "", selected,
                current_user.id, session,
            )
            is_correct = grade["is_correct"]
            earned = q_score * grade["score"] / 100 if grade["score"] else 0
        else:
            is_correct = _check_answer(qt, selected, question.answer or "")
            earned = q_score if is_correct else 0

        total_score += earned

        details.append({
            "question_id": q_id,
            "question_order": question.question_order,
            "section_name": question.section_name,
            "question_type": qt,
            "question_text": question.question_text,
            "selected_answer": selected,
            "correct_answer": question.answer,
            "is_correct": is_correct,
            "score": earned,
            "max_score": q_score,
            "explanation": question.explanation,
        })

    accuracy = round((total_score / max_score) * 100, 1) if max_score > 0 else 0

    return {
        "paper_id": paper_id,
        "total_score": total_score,
        "max_score": max_score,
        "accuracy": accuracy,
        "question_count": len(details),
        "details": details,
    }
