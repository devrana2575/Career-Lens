"""Unit tests for the resume analyzer's pure functions."""

from app.market.extractor import build_skill_terms
from app.resume.analyzer import analyze_resume, skill_section_bullets

SKILLS = [
    {"_id": "skill-python", "name": "Python", "category": "language"},
    {"_id": "skill-sql", "name": "SQL", "category": "database"},
    {"_id": "skill-pandas", "name": "Pandas", "category": "library"},
    {"_id": "skill-ml", "name": "Machine Learning", "category": "concept"},
]
ALIASES = [{"skillId": "skill-ml", "alias": "ML"}]

SKILL_INFO = {s["_id"]: s for s in SKILLS}


def terms():
    return build_skill_terms(SKILLS, ALIASES)


class TestSkillSectionBullets:
    def test_collects_bullets_under_skills_header(self):
        lines = ["Technical Skills", "- Python", "- SQL", "Projects", "- Stuff"]
        bullets = skill_section_bullets(lines)
        assert bullets == ["- Python", "- SQL"]

    def test_closes_section_after_long_prose(self):
        prose = "Worked on a long project using pandas for cleaning and analysis"
        assert skill_section_bullets(["Skills", "- Python", prose]) == ["- Python"]


class TestAnalyzeResume:
    def test_returns_only_skills_actually_mentioned(self):
        hits = analyze_resume("I use Python daily and write SQL at work.", terms(), SKILL_INFO)
        assert {h["skillId"] for h in hits} == {"skill-python", "skill-sql"}

    def test_skills_section_bullets_are_high_prominence(self):
        text = "Technical Skills\n- Python\n- Pandas\n- SQL"
        hits = analyze_resume(text, terms(), SKILL_INFO)
        by_id = {h["skillId"]: h["strength"] for h in hits}
        assert by_id["skill-python"] == "high"
        assert by_id["skill-sql"] == "high"

    def test_repeated_body_mentions_are_medium(self):
        text = (
            "Worked with Python on data pipelines. Built tooling in Python. "
            "Python is my primary automation language."
        )
        hits = analyze_resume(text, terms(), SKILL_INFO)
        python = next(h for h in hits if h["skillId"] == "skill-python")
        assert python["strength"] == "medium"
        assert python["mentions"] >= 3

    def test_single_pass_mention_is_low(self):
        hits = analyze_resume("Light exposure to Pandas during a course.", terms(), SKILL_INFO)
        pandas = next(h for h in hits if h["skillId"] == "skill-pandas")
        assert pandas["strength"] == "low"
        assert pandas["mentions"] == 1

    def test_word_boundary_prevents_ambiguous_short_terms(self):
        text = "Built a website with HTML and styled it in CSS."
        hits = analyze_resume(text, terms(), SKILL_INFO)
        assert {"skill-ml", "skill-sql"} & {h["skillId"] for h in hits} == set()

    def test_empty_text_has_no_hits(self):
        assert analyze_resume("", terms(), SKILL_INFO) == []

    def test_sorts_by_prominence_then_mentions(self):
        text = "Technical Skills\n- Python\nWorked with SQL a few times. SQL is a bonus."
        hits = analyze_resume(text, terms(), SKILL_INFO)
        assert [h["skillId"] for h in hits] == ["skill-python", "skill-sql"]

    def test_unknown_skill_id_gets_no_metadata(self):
        from app.market.extractor import SkillTerm

        stray = SkillTerm(skill_id="skill-nope", terms=("expert",))
        hits = analyze_resume("I am an expert in things.", [stray], SKILL_INFO)
        assert hits[0]["name"] == ""
        assert hits[0]["category"] is None
