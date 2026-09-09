"""Point-in-time market snapshot aggregation.

Snapshots are append-only aggregates keyed by (snapshotDate, roleId,
location, source). Every row carries the raw volume that produced it and a
confidence label so downstream consumers (and users) can see when a signal
is too thin to trust.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

MIN_SUFFICIENT_VOLUME = 5
TOP_SKILLS = 10


def build_snapshot_rows(
    jobs: list[dict[str, Any]], skills_by_job: dict[str, set[str]]
) -> list[dict[str, Any]]:
    """Aggregates classified jobs into one snapshot row per key + date.

    `jobs` must already be normalized/deduplicated/classified (roleId set).
    `skillsByJob` maps job id -> skill ids extracted from that posting.
    """
    buckets: dict[tuple[str, str, str, str], dict[str, Any]] = {}

    for job in jobs:
        date = str(job.get("collectedDate") or "")
        role_id = job.get("roleId")
        if not date or not role_id or not job.get("isActive", True):
            continue
        job_id = str(job.get("_id") or job.get("id") or "")
        location = str(job.get("location") or "unknown")
        source = str(job.get("source") or "demo")
        key = (date, role_id, location, source)
        bucket = buckets.setdefault(
            key,
            {
                "snapshotDate": date,
                "roleId": role_id,
                "location": location,
                "source": source,
                "jobCount": 0,
                "skillCounts": defaultdict(int),
                "experience": [],
            },
        )
        bucket["jobCount"] += 1
        for skill_id in skills_by_job.get(job_id, set()):
            bucket["skillCounts"][skill_id] += 1
        try:
            exp = job.get("experienceYears")
            if exp is not None and float(exp) >= 0:
                bucket["experience"].append(float(exp))
        except (TypeError, ValueError):
            pass

    rows = []
    for bucket in buckets.values():
        job_count = bucket["jobCount"]
        skill_frequencies = sorted(
            (
                {"skillId": skill_id, "count": count}
                for skill_id, count in bucket["skillCounts"].items()
            ),
            key=lambda item: (item["count"], item["skillId"]),
            reverse=True,
        )[:TOP_SKILLS]

        experience = bucket["experience"]
        rows.append(
            {
                "snapshotDate": bucket["snapshotDate"],
                "roleId": bucket["roleId"],
                "location": bucket["location"],
                "source": bucket["source"],
                "jobCount": job_count,
                "skillFrequencies": skill_frequencies,
                "experienceYears": {
                    "min": round(min(experience), 1) if experience else None,
                    "avg": round(sum(experience) / len(experience), 1) if experience else None,
                    "max": round(max(experience), 1) if experience else None,
                },
                "dataVolume": f"{job_count} postings",
                "confidence": (
                    "sufficient" if job_count >= MIN_SUFFICIENT_VOLUME else "insufficient"
                ),
            }
        )
    return rows
