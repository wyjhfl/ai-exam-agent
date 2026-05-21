import pytest
from db.models import QuizQuestion


@pytest.mark.asyncio
async def test_weekly_report_empty(auth_client):
    client, _ = auth_client
    resp = await client.get("/api/analysis/weekly-report")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stats"]["total_quiz"] == 0
    assert data["period"] is not None


@pytest.mark.asyncio
async def test_weekly_report_with_data(auth_client, db_session):
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
    await client.post(
        "/api/quiz/answer",
        json={"question_id": q.id, "selected_answer": "B"},
    )
    resp = await client.get("/api/analysis/weekly-report")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stats"]["total_quiz"] == 1
    assert data["stats"]["accuracy"] == 100.0
