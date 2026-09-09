"""Unit tests for the market pipeline's pure functions."""

from app.market.classifier import (
    MIN_TOTAL_OVERLAP,
    build_role_profiles,
    classify,
    score,
)
from app.market.extractor import build_skill_terms, extract_skills
from app.market.normalizer import clean_text, deduplicate, normalize_location
from app.market.snapshot import MIN_SUFFICIENT_VOLUME, build_snapshot_rows


class TestNormalizer:
    def test_clean_text_lowercases_and_collapses(self):
        assert clean_text("  Python &  Data Science!! ") == "python data science"
        assert clean_text(None) == ""

    def test_clean_text_preserves_term_characters(self):
        expected = "c++ and c# with .net and #hashtags"
        assert clean_text("C++ and C# with .Net and #hashtags") == expected

    def test_clean_text_exchanges_other_punctuation(self):
        expected = "machine learning nlp deep-learning"
        assert clean_text("Machine Learning! (NLP) & Deep-Learning") == expected

    def test_normalize_location_remote_and_unknown(self):
        assert normalize_location("  Remote (US) ") == "remote"
        assert normalize_location("") == "unknown"
        assert normalize_location("Bengaluru") == "bengaluru"

    def test_deduplicate_keeps_richer_duplicate(self):
        base = {
            "title": "Senior Python Engineer",
            "company": "Acme",
            "location": "London",
            "description": "short",
        }
        rich = {**base, "description": "a much longer description with more detail inside"}
        kept = deduplicate([base, rich])
        assert len(kept) == 1
        assert kept[0] is rich


class TestExtractor:
    def test_build_skill_terms_from_ontology(self):
        skills = [
            {"_id": "skill-python", "name": "Python"},
            {"_id": "skill-react", "name": "React"},
        ]
        aliases = [
            {"skillId": "skill-react", "alias": "ReactJS", "canonicalName": "React"},
            {"skillId": "skill-missing", "alias": "Nope"},
        ]
        terms = build_skill_terms(skills, aliases)
        by_id = {t.skill_id: t.terms for t in terms}
        assert "python" in by_id["skill-python"]
        assert "reactjs" in by_id["skill-react"]
        assert "skill-missing" not in by_id

    def test_extract_skills_finds_known_terms_only(self):
        terms = build_skill_terms(
            [{"_id": "skill-python", "name": "Python"}, {"_id": "skill-nlp", "name": "NLP"}],
            [],
        )
        text = "python nlp engineer role; fluent in python."
        assert extract_skills(text, terms) == {"skill-python", "skill-nlp"}
        assert extract_skills("rust developer", terms) == set()

    def test_extract_skills_does_not_substring_match_short_terms(self):
        terms = build_skill_terms(
            [
                {"_id": "skill-ml-fundamentals", "name": "ML Fundamentals"},
                {"_id": "skill-r", "name": "R"},
            ],
            [{"skillId": "skill-ml-fundamentals", "alias": "ML", "canonicalName": None}],
        )
        assert extract_skills("build HTML pages with a grid", terms) == set()
        assert extract_skills("query PostgreSQL for the report", terms) == set()


class TestClassifier:
    PROFILES = build_role_profiles(
        [
            {
                "_id": "role-data-scientist",
                "name": "Data Scientist",
                "slug": "data-scientist",
                "family": "Data & Analytics",
                "description": "Applies statistics and machine learning to extract insight.",
                "isActive": True,
            },
            {
                "_id": "role-backend-developer",
                "name": "Backend Developer",
                "slug": "backend-developer",
                "family": "Software Development",
                "description": "Designs server-side logic and APIs.",
                "isActive": True,
            },
        ]
    )

    def test_classify_picks_best_role(self):
        role = classify(
            "Data Scientist",
            "machine learning statistics python time series forecasting",
            self.PROFILES,
        )
        assert role == "role-data-scientist"

    def test_ambiguous_title_stays_unclassified(self):
        assert classify("Engineer", "does things", self.PROFILES) is None

    def test_low_keyword_signal_stays_unclassified(self):
        assert classify("Random Title", "we need a visionary", self.PROFILES) is None

    def test_score_counts_title_and_keyword_overlap(self):
        profile = self.PROFILES[0]
        overall, title_hits = score("Data Scientist", "data scientist python", profile)
        assert title_hits >= 2
        assert overall >= title_hits >= 1
        assert MIN_TOTAL_OVERLAP > 0


class TestSnapshot:
    JOBS = [
        {
            "_id": "j1",
            "collectedDate": "2026-01-10",
            "roleId": "role-data-scientist",
            "location": "london",
            "source": "demo",
            "isActive": True,
            "experienceYears": 3,
        },
        {
            "_id": "j2",
            "collectedDate": "2026-01-10",
            "roleId": "role-data-scientist",
            "location": "london",
            "source": "demo",
            "isActive": True,
            "experienceYears": 5,
        },
        {
            "_id": "j3",
            "collectedDate": "2026-02-10",
            "roleId": "role-data-scientist",
            "location": "london",
            "source": "demo",
            "isActive": True,
            "experienceYears": None,
        },
        {
            "_id": "j4",
            "collectedDate": "2026-02-10",
            "roleId": None,  # unclassified -> excluded
            "location": "london",
            "source": "demo",
            "isActive": True,
        },
    ]
    SKILLS = {
        "j1": {"skill-python", "skill-pytorch"},
        "j2": {"skill-python"},
        "j3": {"skill-python", "skill-pytorch", "skill-nlp"},
    }

    def test_snapshot_aggregates_per_date_ignoring_unclassified(self):
        rows = build_snapshot_rows(self.JOBS, self.SKILLS)
        assert len(rows) == 2
        jan = [r for r in rows if r["snapshotDate"] == "2026-01-10"][0]
        feb = [r for r in rows if r["snapshotDate"] == "2026-02-10"][0]
        assert jan["jobCount"] == 2
        assert feb["jobCount"] == 1
        python_freq = next(s for s in jan["skillFrequencies"] if s["skillId"] == "skill-python")
        assert python_freq["count"] == 2
        assert jan["experienceYears"]["avg"] == 4.0
        assert jan["experienceYears"]["min"] == 3.0
        assert feb["experienceYears"]["avg"] is None
        assert feb["confidence"] == "insufficient"
        assert feb["dataVolume"] == "1 postings"

        assert jan["confidence"] == "insufficient"
        assert jan["dataVolume"] == "2 postings"
        assert jan["skillFrequencies"][0]["count"] >= feb["skillFrequencies"][0]["count"]

    def test_sufficient_threshold(self):
        assert MIN_SUFFICIENT_VOLUME == 5
        enough = [self.JOBS[0] for _ in range(MIN_SUFFICIENT_VOLUME)]
        rows = build_snapshot_rows(enough, {})
        assert rows[0]["confidence"] == "sufficient"
