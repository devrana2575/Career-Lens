"""
career_readiness.py
Career Readiness Module.

Computes a transparent, rule-based "Career Readiness Score" (0-100) from
the same profile fields used by the ML model. This is intentionally
NOT a machine-learning prediction: every component and weight below is
visible and explainable, and this module never imports or calls
src.predict. The RandomForest model predicts placement likelihood; this
module scores overall profile readiness using a plain weighted formula.

Also derives dynamic strengths / needs-improvement lists from the same
component breakdown, so nothing here is ever hardcoded per-student.
"""

from utils.logger import get_logger

logger = get_logger(__name__)

DISCLOSURE = (
    "Career Readiness Score is calculated using transparent profile rules "
    "and is independent of the ML prediction above — it is not generated "
    "by machine learning."
)

# Each component maps a raw student value onto a 0-100 "how good is this"
# scale via `scale`, then weights that 0-100 score into the overall total.
# Weights sum to 1.0. `scale` functions are intentionally simple (linear
# caps) so the formula stays auditable in the UI's "How is this
# calculated?" expander — no hidden curve-fitting.
_CGPA_CAP = 10.0
_SCHOOL_MARKS_CAP = 100.0
_BACKLOG_PENALTY_PER_BACKLOG = 20.0  # 5+ backlogs -> component score of 0
_PROJECTS_CAP = 8  # 8+ projects -> full component score
_INTERNSHIPS_CAP = 3  # 3+ internships -> full component score (range is 0-3)
_INTERNSHIP_DURATION_CAP = 12  # 12+ months -> full component score
_WORKSHOPS_CAP = 6  # 6+ workshops/certifications -> full component score
_EXTRACURRICULAR_CAP = 5  # 5+ activities -> full component score

_WEIGHTS = {
    "CGPA": 0.20,
    "SSC_Marks": 0.05,
    "HSC_Marks": 0.05,
    "Active_Backlogs": 0.15,
    "Projects": 0.15,
    "Internship_Count": 0.15,
    "Internship_Duration_Months": 0.05,
    "Workshops_Certifications": 0.10,
    "Extracurricular_Activities": 0.05,
    "Placement_Training": 0.05,
}
_FRIENDLY_NAMES = {
    "CGPA": "CGPA",
    "SSC_Marks": "SSC Marks",
    "HSC_Marks": "HSC Marks",
    "Active_Backlogs": "Active Backlogs (fewer is better)",
    "Projects": "Projects Completed",
    "Internship_Count": "Internships Completed",
    "Internship_Duration_Months": "Internship Duration",
    "Workshops_Certifications": "Workshops / Certifications",
    "Extracurricular_Activities": "Extracurricular Activities",
    "Placement_Training": "Placement Training",
}

STRENGTH_THRESHOLD = 75
WEAKNESS_THRESHOLD = 50


def component_score(column: str, value) -> float:
    """
    Map one raw field value onto its 0-100 "how good is this" score.

    Public (not prefixed with _) so any future caller needing this exact
    0-100 normalization (e.g. comparing two profiles on one comparable
    scale, where CGPA on 0-10 and Internships on 0-3 would otherwise be
    apples-to-oranges) can reuse it instead of re-deriving the scaling.
    """
    if column == "CGPA":
        return max(0.0, min(float(value) / _CGPA_CAP * 100, 100.0))
    if column in ("SSC_Marks", "HSC_Marks"):
        return max(0.0, min(float(value) / _SCHOOL_MARKS_CAP * 100, 100.0))
    if column == "Active_Backlogs":
        return max(0.0, 100.0 - float(value) * _BACKLOG_PENALTY_PER_BACKLOG)
    if column == "Projects":
        return max(0.0, min(float(value) / _PROJECTS_CAP * 100, 100.0))
    if column == "Internship_Count":
        return max(0.0, min(float(value) / _INTERNSHIPS_CAP * 100, 100.0))
    if column == "Internship_Duration_Months":
        return max(0.0, min(float(value) / _INTERNSHIP_DURATION_CAP * 100, 100.0))
    if column == "Workshops_Certifications":
        return max(0.0, min(float(value) / _WORKSHOPS_CAP * 100, 100.0))
    if column == "Extracurricular_Activities":
        return max(0.0, min(float(value) / _EXTRACURRICULAR_CAP * 100, 100.0))
    if column == "Placement_Training":
        return 100.0 if value == "Yes" else 0.0
    raise ValueError(f"No readiness scoring rule for column: {column!r}")


def compute_career_readiness(student_data: dict) -> dict:
    """
    Compute the Career Readiness Score and a full transparent breakdown.

    Args:
        student_data: The same dict collected from the input form and
            passed to src.predict.predict().

    Returns:
        {
            "score": int (0-100),
            "label": str,
            "disclosure": str,
            "breakdown": {
                column: {"component_score": float, "weight": float, "friendly": str}
            },
        }
    """
    breakdown = {}
    weighted_total = 0.0

    for column, weight in _WEIGHTS.items():
        score = component_score(column, student_data.get(column))
        weighted_total += score * weight
        breakdown[column] = {
            "component_score": round(score, 1),
            "weight": weight,
            "friendly": _FRIENDLY_NAMES[column],
        }

    score = round(weighted_total)
    label = _interpret_score(score)

    logger.info("Career readiness computed | score=%d | label=%s", score, label)
    return {"score": score, "label": label, "disclosure": DISCLOSURE, "breakdown": breakdown}


def _interpret_score(score: int) -> str:
    if score >= 85:
        return "Excellent Career Readiness"
    if score >= 70:
        return "Good Career Readiness"
    if score >= 50:
        return "Fair Career Readiness"
    return "Needs Improvement"


def analyze_profile(readiness: dict) -> dict:
    """
    Derive dynamic strengths / needs-improvement lists from a readiness
    breakdown. Nothing here is hardcoded per-student — thresholds are
    applied to whatever component scores were actually computed.

    Returns:
        {"strengths": [str, ...], "needs_improvement": [str, ...]}
    """
    breakdown = readiness.get("breakdown", {})

    strengths, needs_improvement = [], []
    for data in breakdown.values():
        if data["component_score"] >= STRENGTH_THRESHOLD:
            strengths.append(data["friendly"])
        elif data["component_score"] < WEAKNESS_THRESHOLD:
            needs_improvement.append(data["friendly"])

    if not strengths:
        strengths.append("Profile shows balanced, developing fundamentals")
    if not needs_improvement:
        needs_improvement.append("No major gaps detected — keep up the momentum")

    return {"strengths": strengths, "needs_improvement": needs_improvement}
