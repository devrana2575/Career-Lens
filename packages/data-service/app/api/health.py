from datetime import datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "career-data-service",
        "timestamp": datetime.now().isoformat(),
    }
