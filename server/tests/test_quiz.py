import pytest
from httpx import AsyncClient
from db.models import QuizQuestion


@pytest.mark.asyncio
async def test_get_questions(client: AsyncClient):
    response = await client.get("/api/quiz/questions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_submit_correct_answer(client: AsyncClient, test_db):
    async with test_db() as session:
        q = QuizQuestion(
            subject="math",
            topic="测试",
            difficulty="easy",
            question_text="2+2=?",
            options=["A. 3", "B. 4", "C. 5", "D. 6"],
            answer="B",
            explanation="2+2=4",
        )
        session.add(q)
        await session.commit()
        q_id = q.id

    response = await client.post("/api/quiz/answer", json={
        "user_id": 1,
        "question_id": q_id,
        "selected_answer": "B",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_correct"] is True
    assert data["correct_answer"] == "B"


@pytest.mark.asyncio
async def test_submit_wrong_answer(client: AsyncClient, test_db):
    async with test_db() as session:
        q = QuizQuestion(
            subject="math",
            topic="测试",
            difficulty="easy",
            question_text="3+3=?",
            options=["A. 5", "B. 6", "C. 7", "D. 8"],
            answer="B",
            explanation="3+3=6",
        )
        session.add(q)
        await session.commit()
        q_id = q.id

    response = await client.post("/api/quiz/answer", json={
        "user_id": 1,
        "question_id": q_id,
        "selected_answer": "A",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_correct"] is False

    wrong_response = await client.get("/api/quiz/wrong/1")
    assert wrong_response.status_code == 200
    wrong_data = wrong_response.json()
    assert any(w["question_id"] == q_id for w in wrong_data)


@pytest.mark.asyncio
async def test_get_wrong_questions(client: AsyncClient):
    response = await client.get("/api/quiz/wrong/1")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
