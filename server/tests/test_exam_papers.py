import pytest
from db.models import ExamPaper, ExamQuestion


@pytest.mark.asyncio
async def test_list_exam_papers(auth_client, db_session):
    client, _ = auth_client
    paper = ExamPaper(
        title="2024年数学一真题",
        subject="数学",
        year=2024,
        exam_type="数学一",
        total_score=150.0,
        duration_minutes=180,
    )
    db_session.add(paper)
    await db_session.commit()

    resp = await client.get("/api/exam-papers")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    assert data["items"][0]["title"] == "2024年数学一真题"


@pytest.mark.asyncio
async def test_get_exam_paper_detail(auth_client, db_session):
    client, _ = auth_client
    paper = ExamPaper(
        title="2024年英语一真题",
        subject="英语",
        year=2024,
        exam_type="英语一",
        total_score=100.0,
        duration_minutes=180,
    )
    db_session.add(paper)
    await db_session.commit()
    await db_session.refresh(paper)

    question = ExamQuestion(
        paper_id=paper.id,
        question_order=1,
        question_text="What is the main idea?",
        question_type="single_choice",
        options=["A", "B", "C", "D"],
        answer="A",
        explanation="The first option is correct.",
        score=10.0,
        section_name="Reading",
    )
    db_session.add(question)
    await db_session.commit()

    resp = await client.get(f"/api/exam-papers/{paper.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "2024年英语一真题"
    assert len(data["questions"]) >= 1
    assert data["questions"][0]["question_text"] == "What is the main idea?"


@pytest.mark.asyncio
async def test_start_exam(auth_client, db_session):
    client, _ = auth_client
    paper = ExamPaper(
        title="2024年政治真题",
        subject="政治",
        year=2024,
        total_score=100.0,
        duration_minutes=180,
    )
    db_session.add(paper)
    await db_session.commit()
    await db_session.refresh(paper)

    question = ExamQuestion(
        paper_id=paper.id,
        question_order=1,
        question_text="Which is correct?",
        question_type="single_choice",
        options=["A", "B", "C", "D"],
        answer="B",
        score=10.0,
    )
    db_session.add(question)
    await db_session.commit()

    resp = await client.post(f"/api/exam-papers/{paper.id}/start")
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data
    assert len(data["questions"]) >= 1


@pytest.mark.asyncio
async def test_submit_exam(auth_client, db_session):
    client, _ = auth_client
    paper = ExamPaper(
        title="2024年数学二真题",
        subject="数学",
        year=2024,
        total_score=150.0,
        duration_minutes=180,
    )
    db_session.add(paper)
    await db_session.commit()
    await db_session.refresh(paper)

    question = ExamQuestion(
        paper_id=paper.id,
        question_order=1,
        question_text="1+1=?",
        question_type="single_choice",
        options=["1", "2", "3", "4"],
        answer="B",
        score=10.0,
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)

    resp = await client.post(f"/api/exam-papers/{paper.id}/submit", json={
        "answers": [{"question_id": question.id, "selected_answer": "B"}],
        "duration_seconds": 300,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_score"] == 10.0
    assert data["question_count"] == 1
    assert data["accuracy"] == 100.0
