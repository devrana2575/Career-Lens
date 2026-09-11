"""Tests for the GitHub analysis API endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

KEY = "change-me"  # dev default from Settings.api_key


def test_requires_api_key() -> None:
    res = client.post("/api/github/analyze", json={"username": "testuser"})
    assert res.status_code == 401


def test_empty_username_returns_400(monkeypatch) -> None:
    from app.api import github as github_api

    monkeypatch.setattr(github_api, "fetch_github_profile", lambda _u: {})
    monkeypatch.setattr(github_api, "fetch_user_repos", lambda _u: [])
    monkeypatch.setattr(github_api, "load_vocab", lambda _s: ([], {}))

    res = client.post(
        "/api/github/analyze",
        headers={"X-API-Key": KEY},
        json={"username": "   "},
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_fetch_failure_returns_502(monkeypatch) -> None:
    from app.api import github as github_api

    def fail(_u):
        raise RuntimeError("network error")

    monkeypatch.setattr(github_api, "fetch_github_profile", fail)
    res = client.post(
        "/api/github/analyze",
        headers={"X-API-Key": KEY},
        json={"username": "baduser"},
    )
    assert res.status_code == 502


def test_analyze_returns_matched_skills(monkeypatch) -> None:
    from app.api import github as github_api
    from app.market.extractor import SkillTerm

    fake_profile = {"login": "testuser", "public_repos": 3}
    fake_repos = [
        {
            "name": "data-pipeline",
            "html_url": "https://github.com/testuser/data-pipeline",
            "stargazers_count": 10,
            "description": "Python data pipeline",
            "language": "Python",
            "topics": ["data", "etl"],
        },
    ]

    monkeypatch.setattr(github_api, "fetch_github_profile", lambda _u: fake_profile)
    monkeypatch.setattr(github_api, "fetch_user_repos", lambda _u: fake_repos)
    monkeypatch.setattr(
        github_api,
        "load_vocab",
        lambda _s: (
            [SkillTerm("skill-python", ("python",))],
            {"skill-python": {"name": "Python", "category": "language"}},
        ),
    )

    res = client.post(
        "/api/github/analyze",
        headers={"X-API-Key": KEY},
        json={"username": "testuser"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "testuser"
    assert len(body["matchedSkills"]) >= 1
    assert body["matchedSkills"][0]["skillId"] == "skill-python"
    assert body["stats"]["publicRepos"] == 1


def test_analyze_empty_repos(monkeypatch) -> None:
    from app.api import github as github_api

    monkeypatch.setattr(github_api, "fetch_github_profile", lambda _u: {"login": "empty"})
    monkeypatch.setattr(github_api, "fetch_user_repos", lambda _u: [])
    monkeypatch.setattr(github_api, "load_vocab", lambda _s: ([], {}))

    res = client.post(
        "/api/github/analyze",
        headers={"X-API-Key": KEY},
        json={"username": "empty"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["matchedSkills"] == []
    assert body["stats"]["publicRepos"] == 0
