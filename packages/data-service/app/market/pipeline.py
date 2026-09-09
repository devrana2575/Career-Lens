"""Market pipeline orchestration against MongoDB.

Reads raw job postings from the `jobs` collection, runs cleaning/de-duplication,
skill extraction and role classification, persists `jobSkills` and append-only
`marketSnapshots`. Re-runs are idempotent: an existing snapshot key
(snapshotDate+roleId+location+source) is never overwritten or duplicated.

Can be run as a CLI (`python -m app.market.pipeline`) or via the operations
endpoint `POST /api/market/build`.
"""

from __future__ import annotations

import argparse
import logging
from typing import Optional

from pymongo import MongoClient

from ..config import Settings, get_settings
from .classifier import build_role_profiles, classify
from .extractor import build_skill_terms, extract_skills
from .normalizer import clean_text, deduplicate, normalize_location
from .snapshot import build_snapshot_rows

logger = logging.getLogger(__name__)

DEFAULT_DB = "career_intelligence"


def run_pipeline(settings: Optional[Settings] = None) -> dict[str, int]:
    settings = settings or get_settings()
    client = MongoClient(settings.mongodb_uri)
    db = client[settings.market_db_name or DEFAULT_DB]

    try:
        jobs = list(db["jobs"].find({}))
        skills = list(db["skills"].find({}))
        aliases = list(db["skillAliases"].find({}))
        roles = list(db["roles"].find({}))

        existing_job_ids = {str(job.get("_id") or job.get("id") or "") for job in jobs}

        skill_terms = build_skill_terms(skills, aliases)
        profiles = build_role_profiles(roles)

        seen = deduplicate(jobs)

        classified = 0
        job_skill_docs: dict[str, set[str]] = {}
        for job in seen:
            title = clean_text(job.get("title"))
            body = " ".join([title, clean_text(job.get("description"))])
            skill_ids = extract_skills(body, skill_terms)
            role_id = classify(title, body, profiles)
            job["roleId"] = role_id
            job["normalizedTitle"] = title
            job["normalizedLocation"] = normalize_location(job.get("location"))
            job_skill_docs[str(job.get("_id") or job.get("id") or "")] = skill_ids
            if role_id:
                classified += 1

        rows = build_snapshot_rows(seen, job_skill_docs)

        created, skipped = 0, 0
        for row in rows:
            key = {
                "snapshotDate": row["snapshotDate"],
                "roleId": row["roleId"],
                "location": row["location"],
                "source": row["source"],
            }
            if db["marketSnapshots"].find_one(key) is not None:
                skipped += 1
                continue
            row["demoData"] = True
            db["marketSnapshots"].insert_one(row)
            created += 1

        # Demo postings only: the pipeline owns this dataset and rewrites it
        # idempotently. Non-demo (live-collected) jobs are never touched so the
        # append-only promise for later sources holds.
        db["jobs"].delete_many({"isDemo": True})
        db["jobs"].insert_many(seen)
        db["jobSkills"].delete_many({"jobId": {"$in": list(existing_job_ids)}})
        skill_docs = [
            {"jobId": job_id, "skillId": skill_id}
            for job_id, skill_ids in job_skill_docs.items()
            for skill_id in skill_ids
        ]
        if skill_docs:
            db["jobSkills"].insert_many(skill_docs)

        return {
            "processed": len(jobs),
            "deduplicated": len(jobs) - len(seen),
            "classified": classified,
            "skillsExtracted": len(skill_docs),
            "snapshotsCreated": created,
            "snapshotsSkipped": skipped,
        }
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Build market snapshots from the jobs dataset")
    parser.add_argument("--uri", default=None, help="MongoDB URI (overrides DATA_MONGODB_URI)")
    parser.add_argument("--db", default=None, help="Database name (overrides DATA_MARKET_DB_NAME)")
    args = parser.parse_args()
    if args.uri:
        get_settings().mongodb_uri = args.uri  # type: ignore[misc]
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    summary = run_pipeline()
    logger.info("Market pipeline complete: %s", summary)


if __name__ == "__main__":
    main()
