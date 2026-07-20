"""
pages/1_model_evaluation.py
Dedicated Model Evaluation page — separated from the prediction flow so
evaluation artifacts (confusion matrix, ROC/PR curves, classification
report, cross-validated model comparison) have their own focused space
instead of being mixed into the prediction page.

Every number here comes straight from models/training_metadata.json,
written once by `python -m src.train_model` — this page never retrains or
recomputes anything live.
"""

import pandas as pd
import streamlit as st

from src import config, feature_importance, visualizations
from utils import streamlit_cache, ui
from utils.logger import get_logger

logger = get_logger(__name__)

st.set_page_config(
    page_title=f"Model Evaluation — {config.APP_NAME}", page_icon="📊", layout="wide",
    initial_sidebar_state="collapsed",
)
ui.inject_css()

ui.page_header(
    "Model Evaluation",
    "How the deployed model was chosen, and how it performs on held-out test data.",
)
st.caption("🔧 Internal developer page — not linked from the main navigation.")

metadata = streamlit_cache.get_metadata()

if not metadata:
    st.error(
        "No training metadata found. Run this first in your terminal:\n\n"
        "`python -m src.train_model`"
    )
    st.stop()

evaluation = metadata.get("evaluation") or {}
comparison = metadata.get("model_comparison") or {}
rationale = metadata.get("selection_rationale", "")
metrics = metadata.get("metrics", {})

# ── Deployed model summary ──────────────────────────────────────────────
ui.section_header("Deployed Model")
with st.container(border=True):
    col1, col2, col3 = st.columns(3)
    col1.metric("Algorithm", metadata.get("model_type", "—"))
    col2.metric("Test Accuracy", f"{metrics.get('accuracy', 0) * 100:.1f}%" if metrics else "—")
    col3.metric("Test ROC-AUC", f"{metrics.get('roc_auc', 0):.3f}" if metrics else "—")
    if rationale:
        ui.disclosure(rationale)

st.write("")

# ── Model comparison ──────────────────────────────────────────────────
ui.section_header("Model Comparison")
with st.container(border=True):
    if not comparison:
        st.info("No model comparison data found — re-run training to generate it.")
    else:
        st.caption(
            f"Every candidate below was evaluated with {metadata.get('cv_folds', 5)}-fold "
            "stratified cross-validation on the training split only — this comparison never "
            "saw the held-out test set used for the metrics above. Random Forest is the "
            "deployed production model regardless of which candidate tops this table; see "
            "the rationale above for why."
        )
        metric_names = list(next(iter(comparison.values())).keys())
        display_rows = {
            name: {
                metric.replace("_", " ").upper(): f"{scores[metric]['mean'] * 100:.2f}% (±{scores[metric]['std'] * 100:.2f})"
                for metric in metric_names
            }
            for name, scores in comparison.items()
        }
        comparison_df = pd.DataFrame(display_rows).T
        comparison_df.index.name = "Model"
        st.dataframe(comparison_df, use_container_width=True)

        metric_choice = st.selectbox(
            "Compare candidates by metric",
            options=metric_names,
            index=metric_names.index(metadata.get("comparison_metric", "roc_auc"))
            if metadata.get("comparison_metric") in metric_names else 0,
            format_func=lambda m: m.replace("_", " ").upper(),
        )
        fig = visualizations.model_comparison_bar(comparison, metric_choice)
        st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── Confusion matrix ─────────────────────────────────────────────────
ui.section_header("Confusion Matrix")
with st.container(border=True):
    cm = evaluation.get("confusion_matrix")
    cm_labels = evaluation.get("confusion_matrix_labels", ["Not Placed", "Placed"])
    if not cm:
        st.info("Confusion matrix data isn't available — re-run training to generate it.")
    else:
        st.caption("Computed on the held-out test set (never seen during training or model comparison).")
        fig = visualizations.confusion_matrix_heatmap(cm, cm_labels)
        st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── ROC & Precision-Recall curves ────────────────────────────────────
col_roc, col_pr = st.columns(2)

with col_roc:
    ui.section_header("ROC Curve")
    with st.container(border=True):
        roc = evaluation.get("roc_curve")
        if not roc:
            st.info("ROC curve data isn't available.")
        else:
            fig = visualizations.roc_curve_chart(roc["fpr"], roc["tpr"], metrics.get("roc_auc", 0.0))
            st.plotly_chart(fig, use_container_width=True)

with col_pr:
    ui.section_header("Precision-Recall Curve")
    with st.container(border=True):
        pr = evaluation.get("pr_curve")
        if not pr:
            st.info("Precision-Recall curve data isn't available.")
        else:
            fig = visualizations.precision_recall_curve_chart(pr["precision"], pr["recall"])
            st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── Classification report ────────────────────────────────────────────
ui.section_header("Classification Report")
with st.container(border=True):
    report = evaluation.get("classification_report")
    if not report:
        st.info("Classification report data isn't available.")
    else:
        rows = {
            label: values for label, values in report.items()
            if isinstance(values, dict)
        }
        report_df = pd.DataFrame(rows).T.round(3)
        report_df = report_df.rename(columns={
            "precision": "Precision", "recall": "Recall",
            "f1-score": "F1 Score", "support": "Support",
        })
        st.dataframe(report_df, use_container_width=True)

st.write("")

# ── Feature importance ────────────────────────────────────────────────
ui.section_header("Feature Importance")
with st.container(border=True):
    st.caption("How much each input feature drove the deployed model's predictions, in aggregate.")
    try:
        pipeline = streamlit_cache.get_pipeline()
        feature_names = streamlit_cache.get_feature_names()
        pairs = feature_importance.get_feature_importance(pipeline, feature_names)
    except Exception:
        logger.exception("Feature importance retrieval failed")
        pairs = None

    if not pairs:
        st.info("Feature importance data isn't available for this model.")
    else:
        labeled_pairs = [(feature_importance.display_label(col), val) for col, val in pairs]
        fig = visualizations.feature_importance_bar(labeled_pairs, top_n=len(labeled_pairs))
        st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── Hyperparameter tuning ───────────────────────────────────────────────
ui.section_header("Hyperparameter Tuning")
with st.container(border=True):
    tuned_params = metadata.get("tuned_hyperparameters")
    tuning_score = metadata.get("tuning_cv_score")
    if not tuned_params:
        st.info("No hyperparameter tuning data found — re-run training to generate it.")
    else:
        st.caption(
            "Selected via RandomizedSearchCV on the training split, scored on "
            "ROC-AUC — see src/config.py::HYPERPARAMETER_SEARCH_SPACE for the full search grid."
        )
        if tuning_score is not None:
            st.metric("Best CV ROC-AUC during search", f"{tuning_score:.3f}")
        st.json(tuned_params)

ui.footer()
