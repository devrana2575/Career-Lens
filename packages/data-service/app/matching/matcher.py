"""Resume-to-job matching orchestration.

Given a resume's text, every active posting is scored on two explainable axes:

- ``skillCoverage`` — the share of the posting's recognized ontology skills that
  the resume presents, weighted by prominence (high > medium > low).
- ``textSimilarity`` — TF-IDF cosine similarity between the resume text and the
  posting's title + description.

The final ``fitScore`` is a 60/40 blend of the two (0-100, rounded). Every match
carries its reason: matched/missing skills, rule-based insights, and actionable
recommendations. A score here is an estimate of how strongly the resume text
overlaps with the posting — never a validated proficiency or a hiring signal.
"""

from __future__ import annotations

from typing import Optional

from ..market.extractor import extract_skills
from ..market.normalizer import clean_text
from ..resume.analyzer import analyze_resume
from .vectorizer import build_vocab, cosine, tfidf, tokenize

STRENGTH_WEIGHT = {"high": 1.0, "medium": 0.7, "low": 0.4}
MAX_MATCH_LIMIT = 50

NOTE = (
    "Fit scores blend prominence-weighted coverage of the posting's recognized skills with "
    "TF-IDF text similarity. They measure textual overlap between your resume and the posting "
    "— an estimate from resume text, never a validated proficiency or a hiring decision."
)


def build_candidate(text: str, terms: list, info: dict[str, dict]) -> dict:
    """Parses the resume into a candidate skill set plus a token bag."""
    hits = analyze_resume(text, terms, info)
    return {
        "skills": hits,
        "skillById": {hit["skillId"]: hit for hit in hits},
        "tokens": tokenize(text),
    }


def job_tokens(job: dict) -> list[str]:
    return tokenize(" ".join([job.get("title") or "", job.get("description") or ""]))


def job_skill_ids(job: dict, terms: list) -> set[str]:
    body = " ".join(
        [clean_text(job.get("title")), clean_text(job.get("description"))]
    )
    return extract_skills(body, terms)


def build_insights(
    matched: list[dict],
    missing: list[dict],
    recognized: int,
    text_pct: int,
) -> list[str]:
    insights: list[str] = []
    plural = "s" if recognized != 1 else ""
    if recognized:
        insights.append(
            f"This posting asks for {recognized} recognized skill{plural}; "
            f"your resume presents {len(matched)} of them."
        )
    else:
        insights.append(
            "This posting lists no recognizable ontology skills, so the score rests "
            "mainly on keyword similarity."
        )

    if text_pct >= 70:
        insights.append(
            "Strong text similarity — your resume wording closely mirrors this posting."
        )
    elif text_pct >= 40:
        insights.append(
            "Moderate text similarity — some keywords overlap, but the posting uses "
            "phrases your resume does not."
        )
    else:
        insights.append(
            "Low text similarity — your resume shares little vocabulary with this posting."
        )

    if missing:
        top = ", ".join(s["name"] or s["skillId"] for s in missing[:3])
        extra = " and more" if len(missing) > 3 else ""
        insights.append(f"Gaps: {top}{extra} appear in this posting but not on your resume.")
    else:
        insights.append("No skill gaps detected against this posting.")
    return insights[:3]


def build_recommendations(missing: list[dict], text_pct: int) -> list[str]:
    recommendations: list[str] = []
    if missing:
        names = ", ".join(s["name"] or s["skillId"] for s in missing[:4])
        more = f" and {len(missing) - 4} more" if len(missing) > 4 else ""
        recommendations.append(
            f"Add evidence for {names}{more} to raise your coverage of this posting."
        )
    if text_pct < 50:
        recommendations.append(
            "Mirror the posting's exact wording for skills you already have — the "
            "vocabulary matches canonical names and aliases, not free-form descriptions."
        )
    if not missing:
        recommendations.append(
            "You cover every recognized skill this posting asks for — call this "
            "overlap out in your application."
        )
    return recommendations


def score_job(
    job: dict,
    candidate: dict,
    terms: list,
    info: dict[str, dict],
    text_similarity: float,
) -> Optional[dict]:
    """Scores one job, or returns None when the posting is unusable."""
    job_id = str(job.get("_id") or job.get("id") or "")
    title = job.get("title") or ""
    if not job_id or not title.strip():
        return None

    skill_ids = job_skill_ids(job, terms)
    matched: list[dict] = []
    missing: list[dict] = []
    covered = 0.0
    for skill_id in sorted(skill_ids):
        meta = info.get(skill_id) or {}
        candidate_hit = candidate["skillById"].get(skill_id)
        item = {
            "skillId": skill_id,
            "name": meta.get("name") or "",
            "category": meta.get("category"),
        }
        if candidate_hit:
            matched.append(
                {
                    **item,
                    "strength": candidate_hit["strength"],
                    "mentions": candidate_hit["mentions"],
                }
            )
            covered += STRENGTH_WEIGHT.get(candidate_hit["strength"], 0.4)
        else:
            missing.append(item)

    if skill_ids:
        skill_coverage = round(100 * min(1.0, covered / len(skill_ids)))
    else:
        skill_coverage = 0

    text_pct = round(text_similarity * 100)
    fit_score = min(100, round(0.6 * skill_coverage + 0.4 * text_pct))

    return {
        "jobId": job_id,
        "title": title,
        "company": job.get("company") or None,
        "location": job.get("location") or None,
        "experienceYears": job.get("experienceYears") or None,
        "postedAt": job.get("postedAt") or None,
        "source": job.get("source") or None,
        "fitScore": fit_score,
        "skillCoverage": skill_coverage,
        "textSimilarity": text_pct,
        "matchedSkills": matched,
        "missingSkills": missing,
        "insights": build_insights(matched, missing, len(skill_ids), text_pct),
        "recommendations": build_recommendations(missing, text_pct),
    }


def summarize(matches: list[dict], evaluated: int) -> dict:
    if not matches:
        return {"jobsEvaluated": evaluated, "meanFit": None, "bestFit": None, "bestJob": None}
    best = matches[0]
    return {
        "jobsEvaluated": evaluated,
        "meanFit": round(sum(m["fitScore"] for m in matches) / len(matches)),
        "bestFit": best["fitScore"],
        "bestJob": {"jobId": best["jobId"], "title": best["title"]},
    }


def match_jobs(
    text: str,
    jobs: list[dict],
    terms: list,
    info: dict[str, dict],
    limit: Optional[int] = None,
) -> dict:
    """Scores every job against the resume and returns rank-ordered matches."""
    candidate = build_candidate(text, terms, info)
    token_docs = [candidate["tokens"]] + [job_tokens(job) for job in jobs]
    idf = build_vocab(token_docs)
    candidate_vector = tfidf(candidate["tokens"], idf)

    matches: list[dict] = []
    for job in jobs:
        similarity = cosine(candidate_vector, tfidf(job_tokens(job), idf))
        match = score_job(job, candidate, terms, info, similarity)
        if match:
            matches.append(match)

    matches.sort(key=lambda m: (-m["fitScore"], -m["skillCoverage"], m["title"].lower()))
    if limit:
        matches = matches[:min(limit, MAX_MATCH_LIMIT)]

    return {
        "matches": matches,
        "candidate": {"skills": candidate["skills"], "detectedSkills": len(candidate["skills"])},
        "summary": summarize(matches, len(jobs)),
        "note": NOTE,
    }
