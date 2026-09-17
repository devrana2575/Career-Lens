"""Resume-to-job matching API.

``POST /api/matching/jobs`` scores the active postings against a candidate's
resume text. The fit score decomposes into prominence-weighted skill coverage
and TF-IDF text similarity, and every match carries matched/missing skills plus
rule-based insights and recommendations — nothing fabricated.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import MongoClient

from ..config import get_settings
from ..matching.matcher import match_jobs
from ..resume.ontology import load_vocab
from .security import require_api_key

MAX_TEXT_CHARS = 50_000
MAX_JOBS = 500
MAX_MATCH_LIMIT = 50

router = APIRouter()


class MatchingRequest(BaseModel):
    text: str
    jobIds: Optional[list[str]] = None
    limit: Optional[int] = Field(default=None, ge=1, le=MAX_MATCH_LIMIT)


def load_jobs(job_ids: Optional[list[str]]) -> list[dict]:
    """Loads active postings from MongoDB, newest-first, capped for safety."""
    settings = get_settings()
    client = MongoClient(settings.mongodb_uri)
    try:
        db = client[settings.market_db_name or "career_intelligence"]
        query = {"isActive": {"$ne": False}}
        if job_ids:
            query["_id"] = {"$in": job_ids}
        return list(db["jobs"].find(query).sort([("collectedDate", -1)]).limit(MAX_JOBS))
    finally:
        client.close()


@router.post("/matching/jobs", dependencies=[Depends(require_api_key)])
def match(payload: MatchingRequest) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Resume text is empty")
    if len(payload.text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"Resume text exceeds the {MAX_TEXT_CHARS:,} character limit",
        )

    terms, info = load_vocab(get_settings())
    jobs = load_jobs(payload.jobIds)
    return match_jobs(text, jobs, terms, info, limit=payload.limit)
