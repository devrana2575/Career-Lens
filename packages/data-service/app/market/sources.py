"""Pluggable job sources for the market pipeline.

Each source fetches raw job postings from a different origin.  Demo jobs come
from the seeded MongoDB data and are owned by the pipeline (rewritten on each
build).  Live-collected jobs (e.g. from an HTTP collector) are never modified
by the pipeline.

Configured via:

- ``DATA_MARKET_SOURCES`` – comma-separated source names (default ``demo,live``)
- ``DATA_MARKET_SOURCE_ENDPOINT`` – base URL for the ``http`` source
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import Settings

logger = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 10


# ------------------------------------------------------------------
# Built-in sources
# ------------------------------------------------------------------


class DemoSource:
    """Reads demo jobs from the seeded MongoDB collection."""

    name = "demo"

    def fetch(self, db: Any, _settings: Settings | None = None) -> list[dict[str, Any]]:
        return list(db["jobs"].find({"isDemo": True}))


class LiveSource:
    """Reads live-collected jobs that the pipeline never rewrites."""

    name = "live"

    def fetch(self, db: Any, _settings: Settings | None = None) -> list[dict[str, Any]]:
        return list(db["jobs"].find({"isDemo": {"$ne": True}}))


class HttpSource:
    """Optional HTTP collector; yields nothing when the endpoint is not set."""

    name = "http"

    def fetch(self, db: Any, settings: Settings | None = None) -> list[dict[str, Any]]:
        endpoint = (settings.market_source_endpoint if settings else "").strip()
        if not endpoint:
            return []
        try:
            resp = httpx.get(
                f"{endpoint.rstrip('/')}/jobs",
                timeout=HTTP_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            jobs = resp.json()
            if not isinstance(jobs, list):
                logger.warning("HTTP source returned non-list payload; ignoring")
                return []
            for job in jobs:
                job.setdefault("source", "http")
                job.setdefault("isDemo", False)
            return jobs
        except Exception:  # noqa: BLE001
            logger.exception("HTTP market source failed")
            return []


# ------------------------------------------------------------------
# Registry
# ------------------------------------------------------------------

_SOURCES: dict[str, type] = {
    "demo": DemoSource,
    "live": LiveSource,
    "http": HttpSource,
}


def build_sources(settings: Settings) -> list[Any]:
    """Instantiates the configured sources in order."""
    names = [n.strip().lower() for n in settings.market_sources.split(",") if n.strip()]
    sources = []
    for name in names:
        cls = _SOURCES.get(name)
        if cls is None:
            logger.warning("Unknown market source %r; skipping", name)
            continue
        sources.append(cls())
    if not sources:
        sources = [DemoSource()]
    return sources


def collect_jobs(db: Any, settings: Settings) -> list[dict[str, Any]]:
    """Fetches jobs from every configured source, merging the results."""
    jobs: list[dict[str, Any]] = []
    for source in build_sources(settings):
        try:
            jobs.extend(source.fetch(db, settings))
        except Exception:  # noqa: BLE001
            logger.exception("Market source %s failed; skipping", source.name)
    return jobs
