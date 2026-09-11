"""Tests for the market build operations endpoint."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app)

KEY = "change-me"


def test_market_build_requires_api_key():
    res = client.post("/api/market/build")
    assert res.status_code == 401


def test_market_build_enqueues_job(monkeypatch):
    from app.api import market

    monkeypatch.setattr(
        market.job_manager, "enqueue", lambda _type, _p: "fake-job-id-123"
    )
    res = client.post("/api/market/build", headers={"X-API-Key": get_settings().api_key})
    assert res.status_code == 202
    body = res.json()
    assert body["jobId"] == "fake-job-id-123"
    assert body["status"] == "pending"
    assert "/api/jobs/fake-job-id-123" in body["statusUrl"]


def test_job_status_returns_result(monkeypatch):
    from app.api import market

    fake_job = {
        "id": "abc123",
        "jobType": "market_build",
        "status": "completed",
        "result": {
            "processed": 48,
            "deduplicated": 3,
            "classified": 40,
            "skillsExtracted": 220,
            "snapshotsCreated": 14,
            "snapshotsSkipped": 0,
        },
        "error": None,
        "createdAt": "2026-01-01T00:00:00Z",
        "startedAt": "2026-01-01T00:00:01Z",
        "finishedAt": "2026-01-01T00:00:05Z",
    }
    monkeypatch.setattr(market.job_manager, "get", lambda _id: fake_job)
    res = client.get("/api/jobs/abc123", headers={"X-API-Key": get_settings().api_key})
    assert res.status_code == 200
    body = res.json()
    assert body["jobId"] == "abc123"
    assert body["status"] == "completed"
    assert body["result"]["processed"] == 48
    assert body["result"]["classified"] == 40


def test_job_status_not_found(monkeypatch):
    from app.api import market

    monkeypatch.setattr(market.job_manager, "get", lambda _id: None)
    res = client.get(
        "/api/jobs/nonexistent", headers={"X-API-Key": get_settings().api_key}
    )
    assert res.status_code == 404
