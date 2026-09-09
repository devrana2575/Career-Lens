"""Skill extraction from job postings via curated term dictionaries.

Transparent word-boundary matching against the ontology's canonical names
and aliases. No inferred skills: a posting only reports skills whose surface
forms literally appear in the cleaned title + description.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class SkillTerm:
    skill_id: str
    terms: tuple[str, ...]


def build_skill_terms(skills: list[dict], aliases: list[dict]) -> list[SkillTerm]:
    """Builds the matching vocabulary from ontology documents.

    `skills` rows need `_id` (or `_id`-style id) and `name`; `aliases` rows
    need `alias`, `skillId` (or `skill_id`). Unknown aliases are ignored so a
    missing ontology entry can never fabricate a skill.
    """
    by_id: dict[str, list[str]] = {}
    for skill in skills:
        skill_id = str(skill.get("_id") or skill.get("id") or "")
        name = skill.get("name") or ""
        if skill_id and name:
            by_id.setdefault(skill_id, []).append(name)
    for alias in aliases:
        skill_id = str(alias.get("skillId") or alias.get("skill_id") or "")
        listed = alias.get("alias")
        canonical = alias.get("canonicalName") or alias.get("canonical_name")
        if skill_id in by_id:
            if listed:
                by_id[skill_id].append(listed)
            if canonical:
                by_id[skill_id].append(canonical)
    from .normalizer import clean_text

    terms = []
    for skill_id, surfaces in by_id.items():
        cleaned = {clean_text(s) for s in surfaces if clean_text(s)}
        if cleaned:
            terms.append(SkillTerm(skill_id=skill_id, terms=tuple(sorted(cleaned))))
    return terms


_BOUNDARY = r"(?<![a-z0-9])(?:{})(?![a-z0-9])"


def _appears(surface: str, text: str) -> bool:
    """Word-boundary match, so short/ambiguous terms do not false-positive.

    Guards keep "ml" out of "html" and "sql" out of "postgresql" while still
    matching terms that end in punctuation such as "c++" and ".net".
    """
    return re.search(_BOUNDARY.format(re.escape(surface)), text) is not None


def extract_skills(text: str, terms: list[SkillTerm]) -> set[str]:
    """Returns the skill ids whose surface forms appear in `text`."""
    found: set[str] = set()
    for term in terms:
        if any(_appears(surface, text) for surface in term.terms):
            found.add(term.skill_id)
    return found
