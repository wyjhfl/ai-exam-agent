import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_get_llm_config_default(auth_client):
    client, _ = auth_client
    response = await client.get("/api/settings/llm")
    assert response.status_code == 200
    data = response.json()
    assert data["is_custom"] is False
    assert data["api_key"] == ""
    assert data["base_url"] == ""
    assert data["model"] == ""


@pytest.mark.asyncio
async def test_update_llm_config(auth_client):
    client, _ = auth_client
    response = await client.put("/api/settings/llm", json={
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
async def test_reset_llm_config(auth_client):
    client, _ = auth_client
    await client.put("/api/settings/llm", json={
        "api_key": "sk-test1234567890abcdef",
        "base_url": "https://api.example.com/v1",
        "model": "gpt-4",
    })

    response = await client.delete("/api/settings/llm")
    assert response.status_code == 200
    data = response.json()
    assert data["is_custom"] is False
    assert data["api_key"] == ""
    assert data["base_url"] == ""
    assert data["model"] == ""


@pytest.mark.asyncio
async def test_test_llm_config_no_key(auth_client):
    client, _ = auth_client
    with patch("api.settings.settings") as mock_settings:
        mock_settings.LLM_API_KEY = ""
        mock_settings.LLM_BASE_URL = ""
        mock_settings.LLM_MODEL = ""

        response = await client.post("/api/settings/llm/test")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
