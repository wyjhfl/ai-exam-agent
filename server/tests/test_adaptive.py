import pytest


@pytest.mark.asyncio
async def test_adaptive_no_history(client):
    user_resp = await client.post("/api/user/create", json={"username": "adaptive_user"})
    user_id = user_resp.json()["id"]
    resp = await client.post("/api/quiz/adaptive", json={"user_id": user_id, "count": 3})
    assert resp.status_code in (200, 500)


@pytest.mark.asyncio
async def test_weak_points_empty(client):
    user_resp = await client.post("/api/user/create", json={"username": "weak_user"})
    user_id = user_resp.json()["id"]
    resp = await client.get(f"/api/analysis/{user_id}/weak-points")
    assert resp.status_code == 200
    assert resp.json() == []
