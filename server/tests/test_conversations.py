import pytest


@pytest.mark.asyncio
async def test_create_conversation(auth_client):
    client, _ = auth_client
    resp = await client.post("/api/conversations", json={
        "title": "Test Conversation",
        "chat_mode": "normal",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Conversation"
    assert data["chat_mode"] == "normal"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_conversations(auth_client):
    client, _ = auth_client
    await client.post("/api/conversations", json={"title": "Conv 1"})
    await client.post("/api/conversations", json={"title": "Conv 2"})

    resp = await client.get("/api/conversations")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_send_message_with_conversation(auth_client):
    client, _ = auth_client
    conv = await client.post("/api/conversations", json={"title": "Chat Conv"})
    conv_id = conv.json()["id"]

    from unittest.mock import patch
    with patch("api.chat.chat_completion_for_user", return_value="AI reply"):
        with patch("api.chat.rag_engine.search", return_value=[]):
            resp = await client.post("/api/chat/message", json={
                "message": "Hello",
                "conversation_id": conv_id,
            })
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_id"] == conv_id
