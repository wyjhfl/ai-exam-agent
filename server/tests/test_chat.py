import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_send_message(auth_client):
    client, _ = auth_client
    with patch("api.chat.chat_completion_for_user", return_value="这是AI的回复"):
        with patch("api.chat.rag_engine.search", return_value=[]):
            response = await client.post("/api/chat/message", json={
                "message": "你好",
            })
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["response"] == "这是AI的回复"


@pytest.mark.asyncio
async def test_get_history(auth_client):
    client, _ = auth_client
    with patch("api.chat.chat_completion_for_user", return_value="AI回复"):
        with patch("api.chat.rag_engine.search", return_value=[]):
            await client.post("/api/chat/message", json={
                "message": "测试消息",
            })

    response = await client.get("/api/chat/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_stream(auth_client):
    client, _ = auth_client
    async def mock_stream(messages, user_id, session):
        yield "你"
        yield "好"

    with patch("api.chat.chat_completion_stream_for_user", side_effect=mock_stream):
        with patch("api.chat.rag_engine.search", return_value=[]):
            response = await client.post("/api/chat/stream", json={
                "message": "你好",
            })

    assert response.status_code == 200
    content = response.text
    assert "data:" in content
