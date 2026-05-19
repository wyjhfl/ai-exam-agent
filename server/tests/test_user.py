import pytest


@pytest.mark.asyncio
async def test_create_user(client):
    resp = await client.post("/api/user/create", json={"username": "testuser"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"
    assert "id" in data


@pytest.mark.asyncio
async def test_get_user(client):
    create_resp = await client.post("/api/user/create", json={"username": "testuser2"})
    user_id = create_resp.json()["id"]
    resp = await client.get(f"/api/user/{user_id}")
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser2"


@pytest.mark.asyncio
async def test_get_nonexistent_user(client):
    resp = await client.get("/api/user/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_register_and_login(client):
    resp = await client.post("/api/user/register", json={
        "username": "logintest",
        "password": "secret123",
    })
    assert resp.status_code == 200
    assert resp.json()["username"] == "logintest"

    login_resp = await client.post("/api/user/login", json={
        "username": "logintest",
        "password": "secret123",
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["username"] == "logintest"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/api/user/register", json={
        "username": "wrongpw",
        "password": "correct",
    })
    resp = await client.post("/api/user/login", json={
        "username": "wrongpw",
        "password": "incorrect",
    })
    assert resp.status_code == 401
