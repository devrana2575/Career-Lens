"""
insights.py
Dashboard/report orchestrator.

app.py renders the Placement Probability hero banner itself, then calls
render_report() once per prediction to render everything below it. This
module owns *layout and narrative order only* — it delegates all
computation to dedicated modules:

    src.career_readiness   — Career Readiness Score + transparency note
    src.feature_importance — Explainable AI (RandomForest importances + why)
    src.recommendations    — rule-based recommendation engine
    src.visualizations     — every Plotly figure

Per the production UI review, the report answers exactly three questions
and nothing else: what's my placement probability (the hero banner in
app.py), why did the model predict this (Career Readiness Score +
Feature Importance), and what should I improve (Personalized
Recommendations). AI Career Summary ties the three together in a short,
dynamically generated narrative — probability, strongest factors,
strengths, weaknesses, and the most impactful next step — built entirely
from this student's own result, never a canned per-outcome template.
Anything that didn't directly serve those questions — duplicate metric
cards, a dataset benchmark chart, an "Improvement Simulator," and a
"Profile Analytics" panel — was cut.

Every section is wrapped defensively so a missing artifact (feature
importances, metadata, etc.) degrades gracefully instead of crashing the
app.
"""

import streamlit as st

from src import career_readiness, feature_importance, recommendations, visualizations
from utils import ui
from utils.logger import get_logger

logger = get_logger(__name__)

_section_header = ui.section_header


def render_report(
    student_data: dict,
    result: dict,
    pipeline,
    feature_names: list[str],
    metadata: dict | None,
) -> None:
    """Render the complete post-prediction analytics report."""
    readiness = _safe_compute_readiness(student_data)
    placed_averages = (metadata or {}).get("placed_averages")

    try:
        importance_pairs = feature_importance.get_feature_importance(pipeline, feature_names)
    except Exception:
        logger.exception("Feature importance retrieval failed")
        importance_pairs = None

    try:
        tips = recommendations.generate_recommendations(student_data, placed_averages)
    except Exception:
        logger.exception("Recommendation generation failed")
        tips = None

    _render_career_readiness(readiness)
    _render_ai_summary(result, readiness, importance_pairs, tips)
    _render_feature_importance(importance_pairs)
    _render_recommendations(tips)


def _safe_compute_readiness(student_data: dict) -> dict | None:
    try:
        return career_readiness.compute_career_readiness(student_data)
    except Exception:
        logger.exception("Career readiness computation failed")
        return None


# ── 1. Career Readiness Score ────────────────────────────────────────────
def _render_career_readiness(readiness: dict | None) -> None:
    _section_header("Career Readiness Score")
    with st.container(border=True):
        if not readiness:
            st.info("Career readiness score is temporarily unavailable.")
            return

        ui.disclosure(readiness["disclosure"])
        fig = visualizations.readiness_gauge(readiness["score"])
        st.plotly_chart(fig, use_container_width=True)


# ── 2. AI Career Summary ──────────────────────────────────────────────────
def _render_ai_summary(
    result: dict,
    readiness: dict | None,
    importance_pairs: list[tuple[str, float]] | None,
    tips: list[dict] | None,
) -> None:
    _section_header("AI Career Summary")
    with st.container(border=True):
        st.markdown(_build_ai_summary(result, readiness, importance_pairs, tips))


_NO_GAP_RECOMMENDATION_TEXT = "Your profile already matches placed-student averages — keep up the consistency."


def _build_ai_summary(
    result: dict,
    readiness: dict | None,
    importance_pairs: list[tuple[str, float]] | None,
    tips: list[dict] | None,
) -> str:
    """
    Compose a mentor-style Career Summary entirely from this student's own
    result — nothing here is a canned per-outcome template. Written in
    second person ("you"/"your") throughout, so it reads as personalized
    career guidance rather than a report written about someone else. Each
    paragraph pulls from a different, already-computed source:

        opening    — result["probability"] / ["placed"] / ["risk_level"]
        drivers    — feature_importance (strongest factors behind the ML
                     prediction itself)
        profile    — career_readiness.analyze_profile (this student's own
                     strongest and weakest readiness components)
        advice     — recommendations (the highest-priority, data-grounded
                     next steps, with their "why")
        conclusion — a closing line whose tone tracks the probability band

    Returns markdown with blank-line paragraph breaks so it reads as
    short mentor-style paragraphs rather than one dense block.
    """
    paragraphs = [_opening_paragraph(result)]

    driver_sentence = _driving_factors_sentence(importance_pairs)
    profile = career_readiness.analyze_profile(readiness) if readiness else None
    profile_sentence = _profile_paragraph(readiness, profile)
    if driver_sentence or profile_sentence:
        paragraphs.append(" ".join(s for s in (driver_sentence, profile_sentence) if s))

    advice_paragraph = _advice_paragraph(tips)
    if advice_paragraph:
        paragraphs.append(advice_paragraph)

    paragraphs.append(_conclusion_sentence(result, readiness))

    return "\n\n".join(paragraphs)


def _opening_paragraph(result: dict) -> str:
    probability = result["probability"]
    placed_phrase = "are likely to be placed" if result["placed"] else "are currently at risk of not being placed"
    return (
        f"You {placed_phrase}, with a placement probability of "
        f"{probability:.0f}% and an overall **{result['risk_level']}** of not being placed."
    )


def _driving_factors_sentence(importance_pairs: list[tuple[str, float]] | None) -> str:
    """Strongest and weakest factors behind the ML prediction itself."""
    if not importance_pairs:
        return ""

    strongest = [feature_importance.display_label(col) for col, _ in importance_pairs[:2]]
    strongest_joined = strongest[0] if len(strongest) == 1 else " and ".join(strongest)
    sentence = f"Your prediction is driven mainly by your {strongest_joined}."

    if len(importance_pairs) > 2:
        weakest_label = feature_importance.display_label(importance_pairs[-1][0])
        sentence += f" Your {weakest_label} carries the least weight in this particular prediction."
    return sentence


def _profile_paragraph(readiness: dict | None, profile: dict | None) -> str:
    """This student's own readiness strengths and improvement areas."""
    if not readiness or not profile:
        return ""

    strengths = [s for s in profile["strengths"] if "developing fundamentals" not in s][:2]
    weaknesses = [w for w in profile["needs_improvement"] if "keep up the momentum" not in w][:2]

    sentence = f"Your Career Readiness is scored at {readiness['score']}/100 ({readiness['label'].lower()})."
    if strengths:
        sentence += f" Your strongest areas are {' and '.join(strengths)}."
    if weaknesses:
        sentence += f" The main areas holding you back are {' and '.join(weaknesses)}."
    return sentence


def _advice_paragraph(tips: list[dict] | None) -> str:
    """Practical, data-grounded advice from the top 1-2 recommendations."""
    if not tips or tips[0]["text"] == _NO_GAP_RECOMMENDATION_TEXT:
        return ""

    lead_in = ["Practically, your most impactful next step is to "
               f"{tips[0]['text'][0].lower()}{tips[0]['text'][1:].rstrip('.')}"]
    if tips[0].get("reason"):
        reason = tips[0]["reason"].rstrip(".")
        lead_in.append(f" — {reason[0].lower()}{reason[1:]}")
    sentence = "".join(lead_in) + "."

    if len(tips) > 1:
        second = tips[1]["text"]
        sentence += f" Worth pairing that with {second[0].lower()}{second[1:]}."
    return sentence


def _conclusion_sentence(result: dict, readiness: dict | None) -> str:
    """A realistic, encouraging closing line whose tone tracks the outcome."""
    probability = result["probability"]
    score_clause = ", and steady work on the readiness gaps above will move the needle further" if readiness else ""

    if probability >= 75:
        return f"Overall, you have a strong, placement-ready profile{score_clause}."
    if probability >= 50:
        return f"Overall, your profile is on solid footing{score_clause}."
    if probability >= 30:
        return (
            "Overall, placement is within reach for you but not yet guaranteed — closing the gaps above "
            "over the next few months would meaningfully improve your odds."
        )
    return (
        "Overall, your profile needs focused work before placement season — but every gap identified above "
        "is addressable with consistent effort."
    )


# ── 3. Feature Importance (Explainable AI) ───────────────────────────────
def _render_feature_importance(importance_pairs: list[tuple[str, float]] | None) -> None:
    _section_header("Feature Importance")
    with st.container(border=True):
        if not importance_pairs:
            st.info("Feature importance data isn't available for this model.")
            return

        st.caption(feature_importance.build_explanation(importance_pairs))
        labeled_pairs = [(feature_importance.display_label(col), val) for col, val in importance_pairs]
        fig = visualizations.feature_importance_bar(labeled_pairs)
        st.plotly_chart(fig, use_container_width=True)


# ── 4. Personalized Recommendations ──────────────────────────────────────
def _render_recommendations(tips: list[dict] | None) -> None:
    _section_header("Personalized Recommendations")
    with st.container(border=True):
        if not tips:
            st.info("Recommendations are temporarily unavailable.")
            return

        for tip in tips:
            priority = tip.get("priority", "Low")
            reason = tip.get("reason", "")
            reason_html = f'<span class="rec-why">{reason}</span>' if reason else ""
            st.markdown(
                f'<div class="rec-card"><span class="rec-check">✓</span>'
                f'<div class="rec-body"><span class="rec-title">{tip["text"]}'
                f'<span class="rec-priority rec-priority--{priority.lower()}">{priority}</span></span>'
                f"{reason_html}</div></div>",
                unsafe_allow_html=True,
            )
