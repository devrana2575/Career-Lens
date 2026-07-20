"""
app.py — Placement Intelligence
Run: streamlit run app.py

This file is intentionally thin: it renders the dataset-driven input form
(every field comes from src/feature_schema.py, nothing is hardcoded to a
specific column name) and, after a prediction, hands off entirely to
src/insights.py to render the compact analytics report. app.py never
touches the model, a Plotly figure, or a scoring formula directly — see
src/predict.py and src/insights.py for that.

Two internal/developer pages live in pages/: Model Evaluation (confusion
matrix, ROC/PR curves, classification report, model comparison) and
Dataset Explorer (dataset preview, distributions, correlations). These
are developer tools, not end-user pages — there is no sidebar and no
navigation UI at all (see utils/ui.py), so the app launches straight
into the dashboard. The page files are untouched and still reachable by
direct URL (e.g. /Model_Evaluation) for internal use.

To point this app at a different dataset: update config.py's
NUMERIC_FEATURES / CATEGORICAL_FEATURES / TARGET_COLUMN, mirror the new
columns in feature_schema.py, retrain with `python -m src.train_model`,
and nothing else needs to change.
"""

import time

import streamlit as st

from src import config, insights, model_utils
from src.exceptions import PlacementPredictorError
from src.feature_schema import FIELD_SCHEMA, SECTION_ORDER, fields_by_section
from src.predict import predict
from utils import streamlit_cache, ui
from utils.logger import get_logger

logger = get_logger(__name__)

st.set_page_config(
    page_title=config.APP_NAME,
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)
ui.inject_css()


def _render_field(column: str, meta: dict, key: str | None = None, disabled: bool = False):
    """Render one form widget from its feature_schema entry and return its value."""
    label = meta["label"]
    widget_key = key or f"form_{column}"

    if meta["widget"] == "slider":
        return st.slider(
            label, meta["min"], meta["max"], meta["default"],
            meta.get("step", 1), help=meta.get("help"), key=widget_key, disabled=disabled,
        )
    if meta["widget"] == "number_input":
        return st.number_input(
            label, min_value=meta["min"], max_value=meta["max"], value=meta["default"],
            step=meta.get("step", 1), help=meta.get("help"), key=widget_key, disabled=disabled,
        )
    if meta["widget"] == "toggle":
        is_yes = st.toggle(
            label, value=(meta["default"] == "Yes"), help=meta.get("help"), key=widget_key, disabled=disabled,
        )
        return "Yes" if is_yes else "No"
    if meta["widget"] == "selectbox":
        options = meta["options"]
        default_index = options.index(meta["default"]) if meta["default"] in options else 0
        return st.selectbox(
            label, options=options, index=default_index, help=meta.get("help"), key=widget_key, disabled=disabled,
        )

    raise ValueError(f"Unsupported widget type in feature_schema: {meta['widget']!r}")


# ── Model check ──────────────────────────────────────────────────────────
if not model_utils.model_exists():
    st.error(
        "Model not found. Run this first in your terminal:\n\n"
        "`python -m src.train_model`"
    )
    st.stop()

metadata = streamlit_cache.get_metadata()

# ── Header ───────────────────────────────────────────────────────────────
# Short hero title + one-line subtitle — the large on-page headline.
ui.page_header(
    "Placement Intelligence",
    "Predict placement probability and receive AI-powered career readiness insights.",
)

# ── Compact intro (only before the first prediction) ────────────────────
if "last_result" not in st.session_state:
    ui.intro_line(
        "Fill in the academic, experience, and additional details below, then click "
        "Predict Placement Chances for a full AI-powered readiness report."
    )

# ── Input form ───────────────────────────────────────────────────────────
# Once a prediction is on screen, the entire form (and the Predict button)
# locks — the only available action is Reset. This guarantees the report
# always reflects exactly the inputs it was generated from.
is_locked = "last_result" in st.session_state

grouped_fields = fields_by_section()
student_data = {}

for section in SECTION_ORDER:
    columns = grouped_fields.get(section, [])
    if not columns:
        continue

    with st.container(border=True):
        ui.section_header(section)

        if len(columns) == 1:
            student_data[columns[0]] = _render_field(
                columns[0], FIELD_SCHEMA[columns[0]], key=f"form_{columns[0]}", disabled=is_locked
            )
        else:
            # One row of evenly balanced columns per section — 3 for
            # Academic, 4 for Experience, 3 for Additional — so every
            # section uses the full available width instead of wrapping
            # onto a second, mostly-empty row.
            num_cols = min(len(columns), 4) if len(columns) >= 3 else 2
            layout_cols = st.columns(num_cols)
            for i, column in enumerate(columns):
                with layout_cols[i % num_cols]:
                    student_data[column] = _render_field(
                        column, FIELD_SCHEMA[column], key=f"form_{column}", disabled=is_locked
                    )

st.write("")
col_predict, col_reset = st.columns([3, 1])
with col_predict:
    predict_clicked = st.button(
        "Predict Placement Chances", use_container_width=True, type="primary", disabled=is_locked
    )
with col_reset:
    reset_clicked = st.button("Reset", use_container_width=True)

if reset_clicked:
    for column in config.FEATURE_COLUMNS:
        st.session_state.pop(f"form_{column}", None)
    st.session_state.pop("last_result", None)
    st.session_state.pop("last_student_data", None)
    st.rerun()

# ── Predict ──────────────────────────────────────────────────────────────
if predict_clicked:
    with st.status("Analyzing your profile...", expanded=True) as status:
        try:
            st.write("🔍 Validating profile...")
            time.sleep(0.25)

            st.write("📊 Running prediction model...")
            result = predict(student_data)
            time.sleep(0.2)

            st.write("🤖 Generating AI career insights...")
            time.sleep(0.25)

            st.write("📈 Calculating placement probability...")
            time.sleep(0.2)

            st.write("✅ Preparing personalized report...")
            time.sleep(0.15)
        except PlacementPredictorError as exc:
            logger.error("Prediction failed: %s", exc)
            status.update(label="Prediction failed", state="error", expanded=False)
            st.error(str(exc))
            st.stop()
        except Exception:
            logger.exception("Unexpected error during prediction")
            status.update(label="Prediction failed", state="error", expanded=False)
            st.error("Something unexpected went wrong. Please try again.")
            st.stop()

        status.update(label="Report ready", state="complete", expanded=False)

    st.toast("Prediction complete")
    st.session_state["last_result"] = result
    st.session_state["last_student_data"] = dict(student_data)

# Render from session_state (not the transient `predict_clicked` flag) so
# the report stays visible across reruns — `predict_clicked` is only True
# on the exact script run where the button was clicked.
if "last_result" in st.session_state:
    result = st.session_state["last_result"]
    predicted_student_data = st.session_state["last_student_data"]

    prob = result["probability"]

    st.markdown('<div id="prediction-results"></div>', unsafe_allow_html=True)
    if predict_clicked:
        # Only auto-scroll on the run where the button was actually
        # clicked — not on every later rerun (e.g. a Reset click or any
        # other widget interaction that reruns the script).
        st.components.v1.html(
            """
            <script>
                const el = window.parent.document.getElementById("prediction-results");
                if (el) { el.scrollIntoView({behavior: "smooth", block: "start"}); }
            </script>
            """,
            height=0,
        )

    if prob >= 75:
        banner_color, banner_text, banner_icon = "#16a34a", "Strong Placement Chances", "✅"
    elif prob >= 50:
        banner_color, banner_text, banner_icon = "#22c55e", "Likely to be Placed", "✅"
    elif prob >= 30:
        banner_color, banner_text, banner_icon = "#d97706", "Borderline Chances", "⚠️"
    else:
        banner_color, banner_text, banner_icon = "#dc2626", "Low Placement Chances", "❌"

    # ── Result banner ────────────────────────────────────────────────────
    st.markdown(
        f"""
        <div class="result-banner" style="background:{banner_color};">
            {banner_icon} {banner_text}
            <span class="result-sub">{prob}% placement probability</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Full analytics report ────────────────────────────────────────────
    st.markdown('<hr class="report-divider">', unsafe_allow_html=True)
    try:
        pipeline = streamlit_cache.get_pipeline()
        feature_names = streamlit_cache.get_feature_names()
        insights.render_report(predicted_student_data, result, pipeline, feature_names, metadata)
    except Exception:
        logger.exception("Failed to render analytics report")
        st.info("Additional analytics are temporarily unavailable.")

# ── Footer ───────────────────────────────────────────────────────────────
ui.footer()
