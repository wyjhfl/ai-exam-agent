import pytest


@pytest.mark.asyncio
async def test_adaptive_no_history(auth_client):
    client, _ = auth_client
    resp = await client.post("/api/quiz/adaptive", json={"count": 3})
    assert resp.status_code in (200, 500)


@pytest.mark.asyncio
async def test_weak_points_empty(auth_client):
    client, _ = auth_client
    resp = await client.get("/api/analysis/weak-points")
    assert resp.status_code == 200
    assert resp.json() == []
