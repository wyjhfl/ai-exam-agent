import pytest


@pytest.mark.asyncio
async def test_mock_exam_history_empty(auth_client):
    client, _ = auth_client
    resp = await client.get("/api/quiz/mock-exam/history")
    assert resp.status_code == 200
    assert resp.json() == []
