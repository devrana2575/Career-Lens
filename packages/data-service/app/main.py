import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.execute import router as execute_router
from .api.github import router as github_router
from .api.health import router as health_router
from .api.jobs import router as jobs_router
from .api.market import router as market_router
from .api.resume import router as resume_router
from .config import get_settings
from .jobs.manager import job_manager
from .market.pipeline import run_pipeline

settings = get_settings()

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Data service started: %s", settings.app_name)
    job_manager.register("market_build", lambda _p: run_pipeline(settings))
    if settings.job_worker_enabled:
        job_manager.start()
    yield
    job_manager.stop()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(execute_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(market_router, prefix="/api")
app.include_router(resume_router, prefix="/api")
app.include_router(github_router, prefix="/api")
