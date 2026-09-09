"""Role classification by transparent keyword overlap.

A posting is mapped to the ontology role whose profile (title words,
description keywords and, at build time, curated requirement terms) overlaps
it most. A minimum overlap and a winning margin keep low-signal postings
honestly unclassified rather than guessed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

MIN_TOTAL_OVERLAP = 3
MIN_TITLE_MATCHES = 1
WINNER_MARGIN = 1


@dataclass(frozen=True)
class RoleProfile:
    role_id: str
    slug: str
    name: str
    title_tokens: frozenset[str]
    keywords: frozenset[str]


def _tokenize(value: str | None) -> set[str]:
    from .normalizer import clean_text

    if not value:
        return set()
    return {t for t in clean_text(value).split() if len(t) > 1}


def build_role_profiles(
    roles: list[dict], requirement_terms: dict[str, list[str]] | None = None
) -> list[RoleProfile]:
    """Builds classification profiles from the (configurable) roles ontology."""
    requirement_terms = requirement_terms or {}
    profiles = []
    for role in roles:
        if not role.get("isActive", True):
            continue
        role_id = str(role.get("_id") or role.get("id") or "")
        name = role.get("name") or ""
        slug = role.get("slug") or ""
        if not role_id:
            continue
        head = _tokenize(name)
        family = _tokenize(role.get("family"))
        desc = _tokenize(role.get("description"))
        extra = {t for phrase in requirement_terms.get(role_id, []) for t in _tokenize(phrase)}
        keywords = head | family | desc | extra
        profiles.append(
            RoleProfile(
                role_id=role_id,
                slug=slug,
                name=name,
                title_tokens=keywords,
                keywords=keywords,
            )
        )
    return profiles


def score(title: str, text: str, profile: RoleProfile) -> int:
    title_set = _tokenize(title)
    terms_in_title = title_set & profile.title_tokens
    text_set = set(_tokenize(text))
    overlap = len(text_set & profile.keywords)
    return len(terms_in_title) + overlap, len(terms_in_title)


def classify(
    title: str,
    text: str,
    profiles: list[RoleProfile],
    *,
    min_total: int = MIN_TOTAL_OVERLAP,
    min_title_matches: int = MIN_TITLE_MATCHES,
    margin: int = WINNER_MARGIN,
) -> Optional[str]:
    """Returns the role id best matching the posting, or None when ambiguous."""
    scored: list[tuple[tuple[int, int], RoleProfile]] = [
        (score(title, text, p), p) for p in profiles
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    if not scored:
        return None
    best = scored[0]
    overall, title_matches = best[0]
    if overall < min_total or title_matches < min_title_matches:
        return None
    if len(scored) > 1:
        second = scored[1][0][0]
        if overall - second < margin:
            return None
    return best[1].role_id
