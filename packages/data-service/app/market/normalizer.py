"""Lightweight text cleaning and de-duplication for raw job postings."""

from __future__ import annotations

import re
from typing import Any

_PUNCT_RE = re.compile(r"[^\w\s+.#/-]+")
_WS_RE = re.compile(r"\s+")


def clean_text(text: str | None) -> str:
    """Lowercases and normalizes whitespace; preserves +,#,.,/, - in terms."""
    if not text:
        return ""
    return _WS_RE.sub(" ", _PUNCT_RE.sub(" ", text.lower())).strip()


def normalize_location(location: str | None) -> str:
    """Maps free-form locations to a small known set (buckets, not geocodes)."""
    cleaned = clean_text(location)
    if not cleaned or cleaned in ("unknown", "unspecified", "anywhere"):
        return "unknown"
    if "remote" in cleaned or "hybrid remote" in cleaned:
        return "remote"
    return cleaned


def job_key(job: dict[str, Any]) -> tuple[str, str, str]:
    """De-duplication key: normalized title + company + location."""
    return (
        clean_text(job.get("title")),
        clean_text(job.get("company")),
        normalize_location(job.get("location")),
    )


def deduplicate(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drops near-duplicate postings, keeping the one with the richest text."""
    seen: dict[tuple[str, str, str], dict[str, Any]] = {}
    for job in jobs:
        key = job_key(job)
        existing = seen.get(key)
        job_len = len(job.get("description") or "")
        existing_len = len(existing.get("description") or "") if existing else -1
        if existing is None or job_len > existing_len:
            seen[key] = job
    return list(seen.values())
