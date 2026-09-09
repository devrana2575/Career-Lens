"""Resume analysis API.

`POST /api/resume/analyze` parses resume text against the ontology vocabulary
and returns the matched skills with a *prominence* strength. No proficiency
score is produced here — resume hits are supporting evidence only.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

from ..config import Settings, get_settings
from ..market.extractor import SkillTerm, build_skill_terms
from ..resume.analyzer import analyze_resume
from .security import require_api_key

MAX_TEXT_CHARS = 50_000

router = APIRouter()


class ResumeAnalysisRequest(BaseModel):
    text: str
    fileName: Optional[str] = None


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


@router.post("/resume/analyze")
def analyze(payload: ResumeAnalysisRequest, _: None = Depends(require_api_key)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Resume text is empty")
    if len(payload.text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"Resume text exceeds the {MAX_TEXT_CHARS:,} character limit",
        )

    terms, info = load_vocab(get_settings())
    matched = analyze_resume(text, terms, info)
    return {
        "fileName": payload.fileName,
        "matchedSkills": matched,
        "note": (
            "Strength reflects how prominently a skill is presented on the resume — "
            "supporting evidence, never a validated proficiency score."
        ),
    }
