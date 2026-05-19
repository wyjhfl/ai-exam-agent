import pytest


@pytest.mark.asyncio
async def test_mock_exam_history_empty(client):
    user_resp = await client.post("/api/user/create", json={"username": "mock_user"})
    user_id = user_resp.json()["id"]
    resp = await client.get(f"/api/quiz/mock-exam/history/{user_id}")
    assert resp.status_code == 200
    assert resp.json() == []
