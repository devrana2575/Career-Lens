"""Tests for the market build operations endpoint."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app)


def test_market_build_requires_api_key():
    res = client.post("/api/market/build")
    assert res.status_code == 401


def test_market_build_runs_pipeline_with_key(monkeypatch):
    from app.api import market

    def fake_run(settings=None):
        return {
            "processed": 48,
            "deduplicated": 3,
            "classified": 40,
            "skillsExtracted": 220,
            "snapshotsCreated": 14,
            "snapshotsSkipped": 0,
        }

    monkeypatch.setattr(market, "run_pipeline", fake_run)
    res = client.post("/api/market/build", headers={"X-API-Key": get_settings().api_key})
    assert res.status_code == 200
    body = res.json()
    assert body["processed"] == 48
    assert body["classified"] == 40
    assert body["snapshotsCreated"] == 14
