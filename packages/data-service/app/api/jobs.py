"""Job status API.

Provides a read endpoint for background job results.  Jobs are enqueued by
other operations (e.g. market build) and processed asynchronously by the
job worker thread.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..jobs.manager import job_manager
from .security import require_api_key

router = APIRouter()


@router.get("/jobs/{job_id}", dependencies=[Depends(require_api_key)])
def get_job_status(job_id: str) -> dict:
    """Returns the current state and result of a background job."""
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "jobId": job.get("id", job_id),
        "jobType": job.get("jobType"),
        "status": job.get("status"),
        "result": job.get("result"),
        "error": job.get("error"),
        "createdAt": job.get("createdAt"),
        "startedAt": job.get("startedAt"),
        "finishedAt": job.get("finishedAt"),
    }
