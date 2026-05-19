import pytest
from db.models import QuizQuestion


@pytest.mark.asyncio
async def test_get_questions_empty(client):
    resp = await client.get("/api/quiz/questions")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_submit_correct_answer(client, db_session):
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

    user_resp = await client.post("/api/user/create", json={"username": "answer_user"})
    assert user_resp.status_code == 200
    user_id = user_resp.json()["id"]

    resp = await client.post("/api/quiz/answer", json={
        "user_id": user_id,
        "question_id": question_id,
        "selected_answer": "B",
    })
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_correct"] is True
    assert resp.json()["correct_answer"] == "B"


@pytest.mark.asyncio
async def test_submit_wrong_answer(client, db_session):
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

    user_resp = await client.post("/api/user/create", json={"username": "wrong_user"})
    assert user_resp.status_code == 200
    user_id = user_resp.json()["id"]

    resp = await client.post("/api/quiz/answer", json={
        "user_id": user_id,
        "question_id": question_id,
        "selected_answer": "A",
    })
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_correct"] is False

    wrong_resp = await client.get(f"/api/quiz/wrong/{user_id}")
    assert wrong_resp.status_code == 200
    wrong_data = wrong_resp.json()
    assert any(w["question_id"] == question_id for w in wrong_data)


@pytest.mark.asyncio
async def test_answer_nonexistent_question(client):
    resp = await client.post("/api/quiz/answer", json={
        "user_id": 1,
        "question_id": 99999,
        "selected_answer": "A",
    })
    assert resp.status_code == 404
