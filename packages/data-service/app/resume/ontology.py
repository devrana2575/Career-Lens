"""Ontology vocabulary loading from MongoDB.

Extractors (resume analyzer, job matching) share one way to load the skill
vocabulary: canonical names + aliases become word-boundary terms, and each
skill id is paired with display metadata (name, category).
"""

from __future__ import annotations

from pymongo import MongoClient

from ..config import Settings
from ..market.extractor import build_skill_terms

DEFAULT_DB = "career_intelligence"


def load_vocab(settings: Settings) -> tuple[list, dict[str, dict]]:
    """Loads the ontology vocabulary and skill metadata from MongoDB."""
    client = MongoClient(settings.mongodb_uri)
    try:
        db = client[settings.market_db_name or DEFAULT_DB]
        skills = list(db["skills"].find({}))
        aliases = list(db["skillAliases"].find({}))
    finally:
        client.close()

    info: dict[str, dict] = {}
    for skill in skills:
        skill_id = str(skill.get("_id") or skill.get("id") or "")
        if skill_id:
            info[skill_id] = {
                "name": skill.get("name") or "",
                "category": skill.get("category") or None,
            }
    return build_skill_terms(skills, aliases), info
