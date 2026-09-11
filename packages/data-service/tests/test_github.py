"""Tests for the GitHub repository analyzer."""

from app.github.analyzer import _strength_from_repo_count, analyze_github
from app.market.extractor import SkillTerm

# ------------------------------------------------------------------
# Module-level fixture data (matching test_resume.py convention)
# ------------------------------------------------------------------

SKILL_PYTHON = SkillTerm(skill_id="skill-python", terms=("python",))
SKILL_SQL = SkillTerm(skill_id="skill-sql", terms=("sql",))
SKILL_REACT = SkillTerm(skill_id="skill-react", terms=("react",))
TERMS = [SKILL_PYTHON, SKILL_SQL, SKILL_REACT]

INFO = {
    "skill-python": {"name": "Python", "category": "language"},
    "skill-sql": {"name": "SQL", "category": "language"},
    "skill-react": {"name": "React", "category": "framework"},
}


def _repo(name, *, language=None, topics=None, desc=None, stars=0, url=""):
    """Helper to build a minimal GitHub repo dict."""
    return {
        "name": name,
        "html_url": url or f"https://github.com/test/{name}",
        "stargazers_count": stars,
        "description": desc,
        "language": language,
        "topics": topics or [],
    }


# ------------------------------------------------------------------
# Strength helper
# ------------------------------------------------------------------


class TestStrengthFromRepoCount:
    def test_zero_repos(self):
        assert _strength_from_repo_count(0) == "low"

    def test_one_repo(self):
        assert _strength_from_repo_count(1) == "low"

    def test_two_repos(self):
        assert _strength_from_repo_count(2) == "medium"

    def test_three_repos(self):
        assert _strength_from_repo_count(3) == "high"

    def test_many_repos(self):
        assert _strength_from_repo_count(10) == "high"


# ------------------------------------------------------------------
# analyze_github
# ------------------------------------------------------------------


class TestAnalyzeGithub:
    def test_empty_repos(self):
        result = analyze_github({}, [], TERMS, INFO)
        assert result["matchedSkills"] == []
        assert result["stats"]["publicRepos"] == 0
        assert result["stats"]["totalStars"] == 0
        assert result["stats"]["activityLevel"] == "low"

    def test_language_match_single_repo(self):
        repos = [_repo("proj", language="Python", stars=5)]
        result = analyze_github({}, repos, TERMS, INFO)
        matched = {s["skillId"]: s for s in result["matchedSkills"]}
        assert "skill-python" in matched
        assert matched["skill-python"]["repoCount"] >= 1
        assert matched["skill-python"]["strength"] == "low"
        assert len(matched["skill-python"]["topRepos"]) == 1

    def test_three_python_repos_high_strength(self):
        repos = [
            _repo("a", language="Python"),
            _repo("b", language="Python"),
            _repo("c", language="Python"),
        ]
        result = analyze_github({}, repos, TERMS, INFO)
        matched = {s["skillId"]: s for s in result["matchedSkills"]}
        assert matched["skill-python"]["strength"] == "high"
        assert matched["skill-python"]["repoCount"] == 3

    def test_topic_match(self):
        repos = [_repo("webapp", topics=["react", "nextjs"])]
        result = analyze_github({}, repos, TERMS, INFO)
        matched = {s["skillId"]: s for s in result["matchedSkills"]}
        assert "skill-react" in matched

    def test_description_match(self):
        repos = [_repo("tool", desc="Built with React and TypeScript")]
        result = analyze_github({}, repos, TERMS, INFO)
        matched = {s["skillId"]: s for s in result["matchedSkills"]}
        assert "skill-react" in matched

    def test_unmatched_skills_absent(self):
        repos = [_repo("a", language="Python")]
        result = analyze_github({}, repos, TERMS, INFO)
        ids = {s["skillId"] for s in result["matchedSkills"]}
        assert "skill-sql" not in ids
        assert "skill-react" not in ids

    def test_activity_level_low(self):
        repos = [_repo(f"r{i}") for i in range(4)]
        result = analyze_github({}, repos, TERMS, INFO)
        assert result["stats"]["activityLevel"] == "low"

    def test_activity_level_medium(self):
        repos = [_repo(f"r{i}") for i in range(5)]
        result = analyze_github({}, repos, TERMS, INFO)
        assert result["stats"]["activityLevel"] == "medium"

    def test_activity_level_high(self):
        repos = [_repo(f"r{i}") for i in range(20)]
        result = analyze_github({}, repos, TERMS, INFO)
        assert result["stats"]["activityLevel"] == "high"

    def test_top_languages_sorted(self):
        repos = [
            _repo("a", language="Python"),
            _repo("b", language="Python"),
            _repo("c", language="SQL"),
        ]
        result = analyze_github({}, repos, TERMS, INFO)
        assert result["stats"]["topLanguages"][:2] == ["Python", "SQL"]

    def test_total_stars(self):
        repos = [_repo("a", stars=10), _repo("b", stars=25)]
        result = analyze_github({}, repos, TERMS, INFO)
        assert result["stats"]["totalStars"] == 35

    def test_note_present(self):
        result = analyze_github({}, [], TERMS, INFO)
        assert "note" in result
        assert "evidence" in result["note"].lower()

    def test_matched_skill_metadata(self):
        repos = [_repo("proj", language="Python")]
        result = analyze_github({}, repos, TERMS, INFO)
        matched = {s["skillId"]: s for s in result["matchedSkills"]}
        assert matched["skill-python"]["skillName"] == "Python"
