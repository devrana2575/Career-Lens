"""GitHub profile and repo analysis.

Maps programming languages and repo topics to ontology skills. Strength is
derived from repo count per skill — not a validated proficiency score.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..market.extractor import SkillTerm, extract_skills
from ..market.normalizer import clean_text


@dataclass(frozen=True)
class RepoInfo:
    name: str
    url: str
    stars: int
    description: str | None
    languages: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)


def _repo_to_info(repo: dict) -> RepoInfo:
    return RepoInfo(
        name=repo.get("name", ""),
        url=repo.get("html_url") or repo.get("url", ""),
        stars=repo.get("stargazers_count", 0),
        description=repo.get("description"),
        languages=[],  # filled in later per-repo via languages endpoint if needed
        topics=repo.get("topics", []),
    )


def _strength_from_repo_count(count: int) -> str:
    if count >= 3:
        return "high"
    if count >= 2:
        return "medium"
    return "low"


def analyze_github(
    profile: dict,
    repos: list[dict],
    terms: list[SkillTerm],
    info: dict[str, dict],
) -> dict:
    """Analyze GitHub profile and repos against the ontology.

    Returns matched skills with strength based on repo count, plus aggregate stats.
    """
    repo_infos = [_repo_to_info(r) for r in repos]

    # Build a searchable text blob from all repos (descriptions, topics, languages)
    blob_parts: list[str] = []
    for r in repo_infos:
        if r.description:
            blob_parts.append(clean_text(r.description))
        for t in r.topics:
            blob_parts.append(clean_text(t))

    all_languages: dict[str, int] = {}
    for repo in repos:
        lang = repo.get("language")
        if lang:
            all_languages[lang] = all_languages.get(lang, 0) + 1
            blob_parts.append(clean_text(lang))

    full_blob = " ".join(blob_parts)
    found = extract_skills(full_blob, terms)

    # Group repos by matched skill
    skill_repos: dict[str, list[RepoInfo]] = {}
    for term in terms:
        if term.skill_id not in found:
            continue
        # Check if any repo explicitly uses this skill as a language or topic
        for r in repo_infos:
            text = " ".join(
                [clean_text(r.name), clean_text(r.description or "")]
                + [clean_text(t) for t in r.topics]
                + [clean_text(l) for l in r.languages]
            )
            if extract_skills(text, [term]):
                skill_repos.setdefault(term.skill_id, []).append(r)
        # If blob-level match but no per-repo match, use all repos as low signal
        if term.skill_id not in skill_repos and repo_infos:
            skill_repos[term.skill_id] = []

    # Build results
    total_stars = sum(r.stars for r in repo_infos)
    top_languages = sorted(all_languages.keys(), key=lambda l: all_languages[l], reverse=True)[:10]

    activity_level = "low"
    if len(repo_infos) >= 20:
        activity_level = "high"
    elif len(repo_infos) >= 5:
        activity_level = "medium"

    matched_skills = []
    for term in terms:
        if term.skill_id not in found:
            continue
        repos_for_skill = skill_repos.get(term.skill_id, [])
        # For blob-level matches without per-repo match, report repos count as 0
        count = len(repos_for_skill)
        if count == 0 and term.skill_id in skill_repos:
            # Blob matched but no specific repo pinned — still a valid signal
            count = min(len(repo_infos), 1)

        strength = _strength_from_repo_count(count) if count > 0 else "low"
        meta = info.get(term.skill_id) or {}
        top = sorted(repos_for_skill, key=lambda r: r.stars, reverse=True)[:5]

        matched_skills.append(
            {
                "skillId": term.skill_id,
                "skillName": meta.get("name", ""),
                "strength": strength,
                "repoCount": count,
                "topRepos": [
                    {
                        "name": r.name,
                        "url": r.url,
                        "stars": r.stars,
                        "description": r.description,
                        "languages": r.languages,
                        "topics": r.topics,
                    }
                    for r in top
                ],
            }
        )

    matched_skills.sort(key=lambda s: {"high": 0, "medium": 1, "low": 2}[s["strength"]])

    return {
        "matchedSkills": matched_skills,
        "stats": {
            "publicRepos": len(repo_infos),
            "totalStars": total_stars,
            "topLanguages": top_languages,
            "activityLevel": activity_level,
        },
        "note": (
            "Strength reflects repo count per skill — supporting evidence, "
            "never a validated proficiency score."
        ),
    }
