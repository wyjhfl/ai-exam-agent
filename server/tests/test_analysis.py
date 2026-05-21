import pytest


@pytest.mark.asyncio
async def test_overview(auth_client):
    client, _ = auth_client
    response = await client.get("/api/analysis/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_study_minutes" in data
    assert "total_quiz_count" in data
    assert "accuracy" in data
    assert "wrong_count" in data


@pytest.mark.asyncio
async def test_subject_stats(auth_client):
    client, _ = auth_client
    response = await client.get("/api/analysis/subject-stats")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
