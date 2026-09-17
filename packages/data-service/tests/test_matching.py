"""Tests for the vectorizer, matcher, and matching API endpoint."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.market.extractor import SkillTerm
from app.matching.matcher import match_jobs
from app.matching.vectorizer import build_vocab, cosine, tfidf, tokenize

client = TestClient(app)

TERMS = [
    SkillTerm(skill_id="python", terms=("python",)),
    SkillTerm(skill_id="sql", terms=("sql",)),
    SkillTerm(skill_id="pandas", terms=("pandas",)),
    SkillTerm(skill_id="ml", terms=("machine learning", "ml")),
    SkillTerm(skill_id="kubernetes", terms=("kubernetes", "k8s")),
]

INFO = {
    "python": {"name": "Python", "category": "language"},
    "sql": {"name": "SQL", "category": "database"},
    "pandas": {"name": "Pandas", "category": "library"},
    "ml": {"name": "Machine Learning", "category": "concept"},
    "kubernetes": {"name": "Kubernetes", "category": "tool"},
}

RESUME = (
    "PROFILE\n"
    "Python engineer building data pipelines.\n"
    "SKILLS\n"
    "- Python\n"
    "- SQL\n"
    "- Pandas\n"
)

JOBS = [
    {
        "_id": "job-1",
        "title": "Python Data Engineer",
        "company": "Acme",
        "location": "Remote",
        "description": "We need Python, SQL, and Pandas to build data pipelines.",
        "collectedDate": None,
    },
    {
        "_id": "job-2",
        "title": "ML Engineer",
        "company": "Beta",
        "location": "Berlin",
        "description": "Machine learning with Kubernetes and Python. ML models on clusters.",
        "collectedDate": None,
    },
    {
        "_id": "job-3",
        "title": "Accountant",
        "company": "Gamma",
        "location": None,
        "description": "Tax returns and bookkeeping.",
        "collectedDate": None,
    },
]


def test_tokenize_lowercases_and_drops_noise():
    assert tokenize("Python 3.9 + SQL, PostgreSQL!") == ["python", "3.9", "sql", "postgresql"]


def test_cosine_ranks_identical_docs_above_unrelated_docs():
    a = ["python", "sql", "pandas", "data", "pipelines"]
    b = ["python", "sql", "pandas", "data", "pipelines"]
    c = ["tax", "returns", "bookkeeping"]
    idf = build_vocab([a, b, c])
    va, vb, vc = tfidf(a, idf), tfidf(b, idf), tfidf(c, idf)
    assert cosine(va, vb) > 0.99
    assert cosine(va, vc) < 0.1


def test_match_jobs_ranks_best_job_first_and_reports_gaps():
    result = match_jobs(RESUME, JOBS, TERMS, INFO, limit=10)

    assert result["candidate"]["detectedSkills"] == 3
    assert result["summary"]["jobsEvaluated"] == 3
    assert result["summary"]["bestJob"] == {"jobId": "job-1", "title": "Python Data Engineer"}
    assert "never a validated proficiency" in result["note"]

    matches = result["matches"]
    assert len(matches) == 3
    assert [m["jobId"] for m in matches] == ["job-1", "job-2", "job-3"]
    assert matches[0]["fitScore"] > matches[1]["fitScore"] > matches[2]["fitScore"]

    best = matches[0]
    assert best["skillCoverage"] == 100
    assert {s["skillId"] for s in best["matchedSkills"]} == {"python", "sql", "pandas"}
    assert best["missingSkills"] == []

    partial = matches[1]
    assert {s["skillId"] for s in partial["missingSkills"]} == {"ml", "kubernetes"}
    assert {s["skillId"] for s in partial["matchedSkills"]} == {"python"}
    assert any("Gaps" in insight for insight in partial["insights"])
    assert any("Add evidence for" in rec for rec in partial["recommendations"])

    worst = matches[2]
    assert worst["skillCoverage"] == 0
    assert worst["missingSkills"] == []


def test_match_jobs_respects_limit():
    result = match_jobs(RESUME, JOBS, TERMS, INFO, limit=1)
    assert len(result["matches"]) == 1
    assert result["matches"][0]["jobId"] == "job-1"
    assert result["summary"]["bestFit"] == result["matches"][0]["fitScore"]


def test_match_jobs_skips_unusable_postings():
    jobs = [dict(JOBS[0]), {"_id": "", "title": "No job id"}, {"_id": "x", "title": "   "}]
    result = match_jobs(RESUME, jobs, TERMS, INFO, limit=None)
    assert [m["jobId"] for m in result["matches"]] == ["job-1"]
    assert result["summary"]["jobsEvaluated"] == 3


def test_match_requires_api_key():
    res = client.post("/api/matching/jobs", json={"text": "Python"})
    assert res.status_code == 401


def test_match_rejects_empty_text(monkeypatch):
    from app.api import matching as matching_api

    def fake_load(_settings):
        return [], {}

    monkeypatch.setattr(matching_api, "load_vocab", fake_load)
    res = client.post(
        "/api/matching/jobs",
        headers={"X-API-Key": get_settings().api_key},
        json={"text": "   "},
    )
    assert res.status_code == 400


def test_match_rejects_oversized_text(monkeypatch):
    from app.api import matching as matching_api

    def fake_load(_settings):
        return [], {}

    monkeypatch.setattr(matching_api, "load_vocab", fake_load)
    res = client.post(
        "/api/matching/jobs",
        headers={"X-API-Key": get_settings().api_key},
        json={"text": "x" * 50_001},
    )
    assert res.status_code == 422


def test_match_endpoint_returns_ranked_matches(monkeypatch):
    from app.api import matching as matching_api

    def fake_load(_settings):
        return TERMS, INFO

    monkeypatch.setattr(matching_api, "load_vocab", fake_load)
    monkeypatch.setattr(matching_api, "load_jobs", lambda _ids: JOBS)

    res = client.post(
        "/api/matching/jobs",
        headers={"X-API-Key": get_settings().api_key},
        json={"text": RESUME, "limit": 5},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["summary"]["jobsEvaluated"] == 3
    assert body["matches"][0]["jobId"] == "job-1"
    assert body["matches"][0]["fitScore"] >= body["matches"][1]["fitScore"]
    assert body["candidate"]["detectedSkills"] == 3
