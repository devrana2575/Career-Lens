"""GitHub analysis API.

`POST /api/github/analyze` fetches a user's public GitHub profile and repos,
maps them against the ontology, and returns matched skills with strength.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

from ..config import Settings, get_settings
from ..github.analyzer import analyze_github
from ..github.client import fetch_github_profile, fetch_user_repos
from ..market.extractor import SkillTerm, build_skill_terms
from .security import require_api_key

router = APIRouter()


class GitHubAnalysisRequest(BaseModel):
    username: str


def load_vocab(settings: Settings) -> tuple[list[SkillTerm], dict[str, dict]]:
    """Loads the ontology vocabulary and skill metadata from MongoDB."""
    client = MongoClient(settings.mongodb_uri)
    try:
        db = client[settings.market_db_name or "career_intelligence"]
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


@router.post("/github/analyze")
def analyze(payload: GitHubAnalysisRequest, _: None = Depends(require_api_key)):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="GitHub username is empty")

    try:
        profile = fetch_github_profile(username)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch GitHub profile for '{username}': {exc}",
        ) from exc

    try:
        repos = fetch_user_repos(username)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch GitHub repos for '{username}': {exc}",
        ) from exc

    terms, info = load_vocab(get_settings())
    result = analyze_github(profile, repos, terms, info)
    result["username"] = username
    return result
