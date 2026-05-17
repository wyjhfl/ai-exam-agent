import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_overview(client: AsyncClient):
    response = await client.get("/api/analysis/1/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_study_minutes" in data
    assert "total_quiz_count" in data
    assert "accuracy" in data
    assert "wrong_count" in data


@pytest.mark.asyncio
async def test_subject_stats(client: AsyncClient):
    response = await client.get("/api/analysis/1/subject-stats")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
