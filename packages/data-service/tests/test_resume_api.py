"""Tests for the resume analysis endpoint."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app)


def test_resume_analyze_requires_api_key():
    res = client.post("/api/resume/analyze", json={"text": "Python"})
    assert res.status_code == 401


def test_resume_analyze_rejects_empty_text(monkeypatch):
    from app.api import resume as resume_api

    def fake_load(_settings):
        return [], {}

    monkeypatch.setattr(resume_api, "load_vocab", fake_load)
    res = client.post(
        "/api/resume/analyze",
        headers={"X-API-Key": get_settings().api_key},
        json={"text": "   "},
    )
    assert res.status_code == 400


def test_resume_analyze_rejects_oversized_text(monkeypatch):
    from app.api import resume as resume_api

    def fake_load(_settings):
        return [], {}

    monkeypatch.setattr(resume_api, "load_vocab", fake_load)
    res = client.post(
        "/api/resume/analyze",
        headers={"X-API-Key": get_settings().api_key},
        json={"text": "x" * 50_001},
    )
    assert res.status_code == 422


def test_resume_analyze_returns_matched_skills(monkeypatch):
    from app.api import resume as resume_api

    matched = [
        {
            "skillId": "skill-python",
            "name": "Python",
            "category": "language",
            "mentions": 3,
            "strength": "high",
        }
    ]

    def fake_load(_settings):
        return [], {}

    def fake_analyze(text, _terms, _info):
        assert text == "Python and SQL"
        return matched

    monkeypatch.setattr(resume_api, "load_vocab", fake_load)
    monkeypatch.setattr(resume_api, "analyze_resume", fake_analyze)
    res = client.post(
        "/api/resume/analyze",
        headers={"X-API-Key": get_settings().api_key},
        json={"text": "Python and SQL", "fileName": "resume.txt"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fileName"] == "resume.txt"
    assert body["matchedSkills"][0]["skillId"] == "skill-python"
    assert body["matchedSkills"][0]["strength"] == "high"
    assert "never a validated proficiency score" in body["note"]
