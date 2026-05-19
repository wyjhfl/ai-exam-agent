import pytest
from unittest.mock import patch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_llm_config_default(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "settingsuser",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    response = await client.get(f"/api/settings/{user_id}/llm")
    assert response.status_code == 200
    data = response.json()
    assert data["is_custom"] is False
    assert data["api_key"] == ""
    assert data["base_url"] == ""
    assert data["model"] == ""


@pytest.mark.asyncio
async def test_update_llm_config(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "settingsuser2",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    response = await client.put(f"/api/settings/{user_id}/llm", json={
        "api_key": "sk-test1234567890abcdef",
        "base_url": "https://api.example.com/v1",
        "model": "gpt-4",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_custom"] is True
    assert data["base_url"] == "https://api.example.com/v1"
    assert data["model"] == "gpt-4"
    assert "sk-***" in data["api_key"] or "***" in data["api_key"]


@pytest.mark.asyncio
async def test_reset_llm_config(client: AsyncClient):
    resp = await client.post("/api/user/register", json={
        "username": "settingsuser3",
        "password": "test1234",
    })
    user_id = resp.json()["user_id"]

    await client.put(f"/api/settings/{user_id}/llm", json={
        "api_key": "sk-test1234567890abcdef",
        "base_url": "https://api.example.com/v1",
        "model": "gpt-4",
    })

    response = await client.delete(f"/api/settings/{user_id}/llm")
    assert response.status_code == 200
    data = response.json()
    assert data["is_custom"] is False
    assert data["api_key"] == ""
    assert data["base_url"] == ""
    assert data["model"] == ""


@pytest.mark.asyncio
async def test_test_llm_config_no_key(client: AsyncClient):
    with patch("api.settings.settings") as mock_settings:
        mock_settings.LLM_API_KEY = ""
        mock_settings.LLM_BASE_URL = ""
        mock_settings.LLM_MODEL = ""

        resp = await client.post("/api/user/register", json={
            "username": "settingsuser4",
            "password": "test1234",
        })
        user_id = resp.json()["user_id"]

        response = await client.post(f"/api/settings/{user_id}/llm/test")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
