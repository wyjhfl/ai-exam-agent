import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_send_message(client: AsyncClient):
    with patch("api.chat.chat_completion_sync", return_value="这是AI的回复"):
        with patch("api.chat.rag_engine.search", return_value=[]):
            response = await client.post("/api/chat/message", json={
                "message": "你好",
                "user_id": 1,
            })
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["response"] == "这是AI的回复"


@pytest.mark.asyncio
async def test_get_history(client: AsyncClient):
    with patch("api.chat.chat_completion_sync", return_value="AI回复"):
        with patch("api.chat.rag_engine.search", return_value=[]):
            await client.post("/api/chat/message", json={
                "message": "测试消息",
                "user_id": 1,
            })

    response = await client.get("/api/chat/history/1")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_stream(client: AsyncClient):
    def mock_stream(messages):
        yield "你"
        yield "好"

    with patch("api.chat.chat_completion_stream", side_effect=mock_stream):
        with patch("api.chat.rag_engine.search", return_value=[]):
            response = await client.post("/api/chat/stream", json={
                "message": "你好",
                "user_id": 1,
            })

    assert response.status_code == 200
    content = response.text
    assert "data:" in content
