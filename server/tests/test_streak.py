import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_checkin_new_user(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "streakuser",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    response = await client.post(f"/api/streak/{user_id}/checkin")
    assert response.status_code == 200
    data = response.json()
    assert data["streak_days"] == 1
    assert data["is_new_day"] is True


@pytest.mark.asyncio
async def test_checkin_duplicate(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "streakuser2",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    await client.post(f"/api/streak/{user_id}/checkin")
    response = await client.post(f"/api/streak/{user_id}/checkin")
    assert response.status_code == 200
    data = response.json()
    assert data["is_new_day"] is False


@pytest.mark.asyncio
async def test_get_streak_empty(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "streakuser3",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    response = await client.get(f"/api/streak/{user_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["streak_days"] == 0
    assert data["max_streak"] == 0
