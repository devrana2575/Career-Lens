"""Market intelligence ingestion endpoint (operations).

Enqueues a market pipeline build as a background job.  The pipeline reads raw
job postings from configured sources, cleans / deduplicates, extracts skills,
classifies roles and writes append-only market snapshots.  Results are available
via the job status endpoint ``GET /api/jobs/{jobId}``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..jobs.manager import job_manager
from .security import require_api_key

router = APIRouter()


@router.post(
    "/market/build",
    status_code=202,
    dependencies=[Depends(require_api_key)],
)
def market_build_endpoint() -> dict:
    """Enqueue a market pipeline build.  Returns a jobId for status polling."""
    job_id = job_manager.enqueue("market_build", {})
    return {"jobId": job_id, "status": "pending", "statusUrl": f"/api/jobs/{job_id}"}
