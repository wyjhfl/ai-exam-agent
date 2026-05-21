import pytest


@pytest.mark.asyncio
async def test_checkin_new_user(auth_client):
    client, _ = auth_client
    response = await client.post("/api/streak/checkin")
    assert response.status_code == 200
    data = response.json()
    assert data["streak_days"] == 1
    assert data["is_new_day"] is True


@pytest.mark.asyncio
async def test_checkin_duplicate(auth_client):
    client, _ = auth_client
    await client.post("/api/streak/checkin")
    response = await client.post("/api/streak/checkin")
    assert response.status_code == 200
    data = response.json()
    assert data["is_new_day"] is False


@pytest.mark.asyncio
async def test_get_streak_empty(auth_client):
    client, _ = auth_client
    response = await client.get("/api/streak")
    assert response.status_code == 200
    data = response.json()
    assert data["streak_days"] == 0
    assert data["max_streak"] == 0
