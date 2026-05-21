import pytest
from db.models import QuizQuestion


@pytest.mark.asyncio
async def test_get_questions_empty(auth_client):
    client, _ = auth_client
    resp = await client.get("/api/quiz/questions")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_submit_correct_answer(auth_client, db_session):
    client, _ = auth_client
    q = QuizQuestion(
        subject="数学",
        topic="极限",
        difficulty="easy",
        question_text="1+1=?",
        question_type="single_choice",
        options=["1", "2", "3", "4"],
        answer="B",
        explanation="简单加法",
    )
    db_session.add(q)
    await db_session.commit()
    await db_session.refresh(q)
    question_id = q.id

    resp = await client.post("/api/quiz/answer", json={
        "question_id": question_id,
        "selected_answer": "B",
    })
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_correct"] is True
    assert resp.json()["correct_answer"] == "B"


@pytest.mark.asyncio
async def test_submit_wrong_answer(auth_client, db_session):
    client, _ = auth_client
    q = QuizQuestion(
        subject="数学",
        topic="极限",
        difficulty="easy",
        question_text="1+1=?",
        question_type="single_choice",
        options=["1", "2", "3", "4"],
        answer="B",
        explanation="",
    )
    db_session.add(q)
    await db_session.commit()
    await db_session.refresh(q)
    question_id = q.id

    resp = await client.post("/api/quiz/answer", json={
        "question_id": question_id,
        "selected_answer": "A",
    })
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_correct"] is False

    wrong_resp = await client.get("/api/quiz/wrong")
    assert wrong_resp.status_code == 200
    wrong_data = wrong_resp.json()
    assert any(w["question_id"] == question_id for w in wrong_data)


@pytest.mark.asyncio
async def test_answer_nonexistent_question(auth_client):
    client, _ = auth_client
    resp = await client.post("/api/quiz/answer", json={
        "question_id": 99999,
        "selected_answer": "A",
    })
    assert resp.status_code == 404
