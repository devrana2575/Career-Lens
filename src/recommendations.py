"""
recommendations.py
Recommendation Engine.

Generates profile-specific recommendations by comparing the student's own
input values against the *actual average values of placed students* in
the training dataset (computed once at training time by
train_model._compute_placed_averages and stored in training_metadata.json
— see model_utils.load_metadata). This is deliberately data-driven rather
than generic advice: a recommendation only fires when the student's value
is actually behind (or ahead, for backlogs) the placed-student benchmark
for that field — a profile that already matches or beats the benchmark on
a given field gets no recommendation for it.

On top of that gating, the *wording* of each recommendation is
context-aware: it's chosen from the student's own current value rather
than a single fixed sentence per field, so "no internships yet" and
"one internship" and "two internships" each read as a distinct, natural
next step instead of the same generic line. See the _*_message() helpers
below for the exact wording rules per field.

Each recommendation carries a priority (High / Medium / Low) reflecting
how strongly that feature relates to placement outcome (see
career_readiness._WEIGHTS / the dataset's generation weights in
scripts/generate_dataset.py) — CGPA, internships, and backlogs carry the
most weight, so gaps there surface first. Display text is kept to a
single short, concrete action (no inline statistics) so the UI can show
it as a compact checklist rather than a paragraph; the data-grounded
comparison lives in `reason` instead.
"""

from src.feature_schema import FIELD_SCHEMA
from utils.logger import get_logger

logger = get_logger(__name__)


def _field_label(column: str) -> str:
    return FIELD_SCHEMA.get(column, {}).get("label", column)


# ── Context-aware message builders ──────────────────────────────────────
# Each takes the student's own current value for that field and returns
# the sentence that best matches where they actually are — not a single
# generic line reused regardless of value.

def _internship_message(value: float) -> str:
    count = int(value)
    if count <= 0:
        return "Complete your first internship."
    if count == 1:
        return "Complete another internship."
    return "Gain additional internship experience."


def _project_message(value: float) -> str:
    count = int(value)
    if count <= 0:
        return "Build your first project."
    if count == 1:
        return "Build another project."
    return "Build more advanced projects."


def _certification_message(value: float) -> str:
    return "Earn your first certification." if int(value) <= 0 else "Earn another certification."


def _internship_duration_message(value: float) -> str:
    return "Gain practical internship experience." if int(value) <= 0 else "Increase your internship duration."


def _cgpa_message(value: float) -> str:
    if value < 6.0:
        return "Focus on significantly improving your CGPA to strengthen your placement readiness."
    if value < 7.5:
        return "Improve your CGPA to strengthen your placement readiness."
    return "Polish your CGPA a little further to match top placed profiles."


def _backlog_message(_value: float) -> str:
    return "Clear your active backlogs to strengthen your placement readiness."


def _extracurricular_message(_value: float) -> str:
    return "Join an extracurricular activity."


# direction: "higher_better" fires when the student's value is below the
# placed-student average; "lower_better" fires when it's above.
# message_fn receives the student's own current value for the field and
# returns the context-aware sentence for that value.
_RULES = [
    {"column": "CGPA", "direction": "higher_better", "priority": "High", "message_fn": _cgpa_message},
    {"column": "Active_Backlogs", "direction": "lower_better", "priority": "High", "message_fn": _backlog_message},
    {"column": "Internship_Count", "direction": "higher_better", "priority": "High", "message_fn": _internship_message},
    {"column": "Projects", "direction": "higher_better", "priority": "Medium", "message_fn": _project_message},
    {"column": "Internship_Duration_Months", "direction": "higher_better", "priority": "Medium", "message_fn": _internship_duration_message},
    {"column": "Workshops_Certifications", "direction": "higher_better", "priority": "Medium", "message_fn": _certification_message},
    {"column": "Extracurricular_Activities", "direction": "higher_better", "priority": "Low", "message_fn": _extracurricular_message},
    {"column": "Placement_Training", "direction": "categorical_no", "priority": "Low", "message_fn": None},
]

_PLACEMENT_TRAINING_MESSAGE = "Complete a placement training program."

MAX_RECOMMENDATIONS = 5


def generate_recommendations(student_data: dict, placed_averages: dict | None) -> list[dict]:
    """
    Build a prioritized, dataset-grounded, context-aware recommendation list.

    Args:
        student_data: The same dict passed to src.predict.predict().
        placed_averages: {"CGPA": {"mean": ...}, ..., "Placement_Training":
            {"placed_rate": ...}} — computed once at training time on the
            placed-student subset of the dataset. If unavailable (e.g.
            older training_metadata.json), falls back to a generic message.

    Returns:
        [{"text": str, "priority": "High"/"Medium"/"Low", "reason": str}, ...]
        sorted High -> Low, capped to MAX_RECOMMENDATIONS. `text` is chosen
        from the student's own current value for that field (context-aware
        wording); `reason` is a short, data-grounded explanation of why
        that recommendation matters.
    """
    if not placed_averages:
        logger.warning("No placed_averages in metadata — recommendations degraded to generic advice")
        return [{
            "text": "Re-run training to unlock personalized recommendations.",
            "priority": "Low",
            "reason": "Personalized, data-grounded advice needs training metadata that isn't available yet.",
        }]

    candidates = []
    priority_rank = {"High": 3, "Medium": 2, "Low": 1}

    for rule in _RULES:
        column = rule["column"]
        stats = placed_averages.get(column)
        if not stats:
            continue

        label = _field_label(column)

        if rule["direction"] == "categorical_no":
            # Already completed placement training -> nothing to recommend here.
            if student_data.get(column) == "No":
                placed_rate = stats.get("placed_rate")
                reason = (
                    f"Students who completed {label.lower()} were placed more often in the training data."
                    if placed_rate is None
                    else (
                        f"{placed_rate * 100:.0f}% of placed students in the training data had "
                        f"completed {label.lower()}."
                    )
                )
                candidates.append(
                    (priority_rank[rule["priority"]], 0.0, rule["priority"], _PLACEMENT_TRAINING_MESSAGE, reason)
                )
            continue

        value = float(student_data.get(column, 0))
        avg = stats.get("mean", 0.0)

        # Active backlogs at zero means there's nothing to reduce, regardless
        # of what the placed-student average happens to be.
        if column == "Active_Backlogs" and value <= 0:
            continue

        if rule["direction"] == "higher_better" and value < avg:
            gap = avg - value
            reason = f"Placed students in this dataset average {avg:.1f} for {label}; your profile has {value:.1f}."
            message = rule["message_fn"](value)
            candidates.append((priority_rank[rule["priority"]], gap, rule["priority"], message, reason))
        elif rule["direction"] == "lower_better" and value > avg:
            gap = value - avg
            reason = f"Placed students in this dataset average {avg:.1f} for {label}; your profile has {value:.1f}."
            message = rule["message_fn"](value)
            candidates.append((priority_rank[rule["priority"]], gap, rule["priority"], message, reason))

    # Highest priority tier first; within a tier, larger gap first.
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)

    recommendations = [
        {"text": text, "priority": priority, "reason": reason}
        for _, _, priority, text, reason in candidates[:MAX_RECOMMENDATIONS]
    ]

    if not recommendations:
        recommendations.append({
            "text": "Your profile already matches placed-student averages — keep up the consistency.",
            "priority": "Low",
            "reason": "No significant gaps were found against placed-student averages in the training data.",
        })

    logger.info("Generated %d recommendation(s)", len(recommendations))
    return recommendations
