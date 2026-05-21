import pytest


@pytest.mark.asyncio
async def test_search_empty(auth_client):
    client, _ = auth_client
    response = await client.get("/api/search", params={"q": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_search_questions(auth_client):
    client, _ = auth_client
    await client.post("/api/quiz/generate", json={
        "subject": "数学",
        "topic": "微积分极限",
        "count": 2,
    })

    response = await client.get("/api/search", params={"q": "极限", "type": "questions"})
    assert response.status_code == 200
    data = response.json()
    if data["total"] > 0:
        assert data["results"][0]["type"] == "question"


@pytest.mark.asyncio
async def test_search_no_results(auth_client):
    client, _ = auth_client
    response = await client.get("/api/search", params={"q": "xyznonexistent12345"})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    assert data["total"] == 0
