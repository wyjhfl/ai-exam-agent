import pytest


@pytest.mark.asyncio
async def test_weekly_report_empty(client):
    user_resp = await client.post("/api/user/create", json={"username": "report_user"})
    user_id = user_resp.json()["id"]
    resp = await client.get(f"/api/analysis/{user_id}/weekly-report")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stats"]["total_quiz"] == 0
    assert data["period"] is not None


@pytest.mark.asyncio
async def test_weekly_report_with_data(client, db_session):
    from db.models import QuizQuestion

    user_resp = await client.post("/api/user/create", json={"username": "report_user2"})
    user_id = user_resp.json()["id"]
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
        json={"user_id": user_id, "question_id": q.id, "selected_answer": "B"},
    )
    resp = await client.get(f"/api/analysis/{user_id}/weekly-report")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stats"]["total_quiz"] == 1
    assert data["stats"]["accuracy"] == 100.0
