"""Resume skill analysis.

Reads a student's resume text and reports which ontology skills it mentions.
`strength` here means *prominence* — how saliently a skill is presented (e.g.
as a standalone bullet in a skills section versus a single passing mention).
It is never treated as a validated proficiency score; the evidence graph keeps
resume hits as supporting evidence on top of other sources.

Matching reuses the market extractor's word-boundary vocabulary so a resume
that says "HTML" never claims "ML", and "Pandas" is not confused with "Panda".
"""

from __future__ import annotations

import re

from ..market.extractor import SkillTerm, extract_skills

SECTION_HEADER = re.compile(
    r"(?i)^[^:]{0,40}?"
    r"(?:technical|core)?\s*(?:skills?|tools|technologies?|tech stack|stack)\s*:?\s*$"
)
BULLET = re.compile(r"^\s*(?:[-*•·–—]|\d+[.)])\s+\S")
_TERM_BOUNDARY = r"(?<![a-z0-9])(?:{})(?![a-z0-9])"

_PROMINENCE_RANK = {"high": 0, "medium": 1, "low": 2}


def skill_section_bullets(lines: list[str]) -> list[str]:
    """Collects bullet items that sit under a skills-style header.

    Any non-bullet line (e.g. the next section header) closes the section so
    body text is never mistaken for a skills list.
    """
    in_section = False
    bullets: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if SECTION_HEADER.fullmatch(line):
            in_section = True
            continue
        if not in_section:
            continue
        if BULLET.match(line):
            bullets.append(line)
        else:
            in_section = False
    return bullets


def count_mentions(term: SkillTerm, text: str) -> int:
    """Counts word-boundary occurrences of any of the term's surface forms."""
    total = 0
    for surface in term.terms:
        total += len(re.findall(_TERM_BOUNDARY.format(re.escape(surface)), text))
    return total


def _in_bullets(term: SkillTerm, bullets: list[str]) -> bool:
    for bullet in bullets:
        for surface in term.terms:
            if re.search(_TERM_BOUNDARY.format(re.escape(surface)), bullet, re.IGNORECASE):
                return True
    return False


def analyze_resume(text: str, terms: list[SkillTerm], info: dict[str, dict]) -> list[dict]:
    """Returns matched skills with prominence strength, sorted high-to-low.

    `info` maps `skill_id` to `{"name", "category"}` metadata.
    """
    from ..market.normalizer import clean_text

    body = clean_text(text)
    bullets = skill_section_bullets(text.splitlines())
    found = extract_skills(body, terms)

    hits = []
    for term in terms:
        if term.skill_id not in found:
            continue
        mentions = count_mentions(term, body)
        if _in_bullets(term, bullets):
            strength = "high"
        elif mentions >= 3:
            strength = "medium"
        else:
            strength = "low"
        meta = info.get(term.skill_id) or {}
        hits.append(
            {
                "skillId": term.skill_id,
                "name": meta.get("name") or "",
                "category": meta.get("category") or None,
                "mentions": mentions,
                "strength": strength,
            }
        )

    hits.sort(key=lambda h: (_PROMINENCE_RANK[h["strength"]], -h["mentions"]))
    return hits
