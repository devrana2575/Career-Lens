"""Lightweight MongoDB-backed background job queue.

A single worker thread polls a ``jobs`` collection for ``pending`` jobs, marks
them ``running``, invokes the registered handler, then records ``completed``
or ``failed``.  Sufficient for the market pipeline today; swap for a real
broker (Celery / dramatiq / BullMQ) if we outgrow it.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from bson import ObjectId
from pymongo import MongoClient, ReturnDocument

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

DEFAULT_DB = "career_intelligence"
POLL_INTERVAL_SECONDS = 1.0


class JobManager:
    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        self._db: Any = None
        self._handlers: dict[str, Callable[..., Any]] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------
    # Database (lazy – never connected until the first enqueue / get / poll)
    # ------------------------------------------------------------------

    def _database(self) -> Any:
        if self._db is None:
            client = MongoClient(self._settings.mongodb_uri)
            self._db = client[self._settings.market_db_name or DEFAULT_DB]
        return self._db

    # ------------------------------------------------------------------
    # Handler registry
    # ------------------------------------------------------------------

    def register(self, job_type: str, handler: Callable[..., Any]) -> None:
        self._handlers[job_type] = handler

    # ------------------------------------------------------------------
    # Enqueue / query
    # ------------------------------------------------------------------

    def enqueue(self, job_type: str, payload: Optional[dict[str, Any]] = None) -> str:
        now = datetime.now(timezone.utc)
        doc = {
            "jobType": job_type,
            "status": "pending",
            "payload": payload or {},
            "result": None,
            "error": None,
            "createdAt": now,
            "startedAt": None,
            "finishedAt": None,
        }
        res = self._database()["jobs"].insert_one(doc)
        return str(res.inserted_id)

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        try:
            doc = self._database()["jobs"].find_one({"_id": ObjectId(job_id)})
        except Exception:  # noqa: BLE001 – bad ObjectId format
            return None
        if doc is None:
            return None
        doc["id"] = str(doc.pop("_id"))
        return doc

    # ------------------------------------------------------------------
    # Worker thread
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()
        logger.info("Job worker started")

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=3)
        logger.info("Job worker stopped")

    # ------------------------------------------------------------------

    def _poll_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._process_next()
            except Exception:  # noqa: BLE001 – worker must not crash
                logger.exception("Job worker error")
            self._stop.wait(POLL_INTERVAL_SECONDS)

    def _process_next(self) -> None:
        db = self._database()
        claimed = db["jobs"].find_one_and_update(
            {"status": "pending"},
            {"$set": {"status": "running", "startedAt": datetime.now(timezone.utc)}},
            sort=[("createdAt", 1)],
            return_document=ReturnDocument.AFTER,
        )
        if claimed is None:
            return

        job_type = claimed.get("jobType", "")
        handler = self._handlers.get(job_type)
        if handler is None:
            db["jobs"].update_one(
                {"_id": claimed["_id"]},
                {"$set": {"status": "failed", "error": f"No handler for job type: {job_type}"}},
            )
            return

        try:
            result = handler(claimed.get("payload"))
            db["jobs"].update_one(
                {"_id": claimed["_id"]},
                {
                    "$set": {
                        "status": "completed",
                        "result": result,
                        "finishedAt": datetime.now(timezone.utc),
                    }
                },
            )
        except Exception as exc:  # noqa: BLE001 – store error, don't crash
            db["jobs"].update_one(
                {"_id": claimed["_id"]},
                {
                    "$set": {
                        "status": "failed",
                        "error": str(exc),
                        "finishedAt": datetime.now(timezone.utc),
                    }
                },
            )


job_manager = JobManager()
