"""Market intelligence ingestion endpoint (operations).

Runs the market pipeline against the configured MongoDB: cleans the demo job
dataset, extracts skills, classifies roles and writes append-only market
snapshots. Guarded by the shared X-API-Key so a user request can never trigger
a build.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import get_settings
from ..market.pipeline import run_pipeline
from .security import require_api_key

router = APIRouter()


class MarketBuildResult(BaseModel):
    processed: int
    deduplicated: int
    classified: int
    skillsExtracted: int
    snapshotsCreated: int
    snapshotsSkipped: int


@router.post(
    "/market/build",
    response_model=MarketBuildResult,
    dependencies=[Depends(require_api_key)],
)
def market_build_endpoint() -> MarketBuildResult:
    return MarketBuildResult(**run_pipeline(get_settings()))
