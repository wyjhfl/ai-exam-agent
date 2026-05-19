import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_empty(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "searchuser",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    response = await client.get(f"/api/search/{user_id}", params={"q": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_search_questions(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "searchuser2",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    await client.post("/api/quiz/generate", json={
        "subject": "数学",
        "topic": "微积分极限",
        "count": 2,
        "user_id": user_id,
    })

    response = await client.get(f"/api/search/{user_id}", params={"q": "极限", "type": "questions"})
    assert response.status_code == 200
    data = response.json()
    if data["total"] > 0:
        assert data["results"][0]["type"] == "question"


@pytest.mark.asyncio
async def test_search_no_results(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "searchuser3",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    response = await client.get(f"/api/search/{user_id}", params={"q": "xyznonexistent12345"})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    assert data["total"] == 0
