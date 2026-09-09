"""
feature_importance.py
Explainable AI module.

Extracts per-feature importance from whichever model src.model_comparison
selected for deployment — feature_importances_ for tree-based models
(Random Forest, Decision Tree), |coefficient| for linear models (Logistic
Regression). Those importances are computed on the *post-encoding*
columns (e.g. "HSC_Stream_Commerce", "HSC_Stream_Science", ...), so this
module aggregates them back to the original 11 input fields before
displaying anything — a chart with 19 one-hot bars would be unreadable and
wouldn't match what the user actually entered in the form.

It also turns each feature's importance into a beginner-friendly "why"
explanation, using the directional effects computed once at training time
(src.train_model._compute_feature_effects, stored in training metadata)
rather than jargon like "positive coefficient" or "SHAP value".
"""

import numpy as np

from src import config, preprocessing
from src.feature_schema import FIELD_SCHEMA
from utils.logger import get_logger

logger = get_logger(__name__)


def _extract_raw_importances(model) -> np.ndarray:
    """
    Return a per-(post-encoding)-column importance array for whichever
    model type was actually deployed.

    Tree-based models (Random Forest, Decision Tree) expose
    feature_importances_ directly. Linear models (Logistic Regression)
    don't — their analogue is the absolute value of each coefficient,
    since a larger |coefficient| means that column moves the prediction
    more per unit of (standardized) input. Values are normalized to sum
    to 1 either way, so downstream percentage displays mean the same
    thing regardless of which model won model comparison.
    """
    if hasattr(model, "feature_importances_"):
        raw = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        raw = np.abs(np.asarray(model.coef_, dtype=float)).ravel()
    else:
        raise AttributeError(
            f"{type(model).__name__} exposes neither feature_importances_ nor coef_."
        )

    total = raw.sum()
    return raw / total if total > 0 else raw


def _source_column(transformed_name: str) -> str:
    """Map a post-encoding column name back to its original input field."""
    if transformed_name in config.NUMERIC_FEATURES:
        return transformed_name
    for column in config.CATEGORICAL_FEATURES:
        if transformed_name.startswith(f"{column}_"):
            return column
    return transformed_name  # pragma: no cover — schema/pipeline drifted


def get_feature_importance(pipeline, feature_names: list[str]) -> list[tuple[str, float]] | None:
    """
    Return [(original_column, aggregated_importance), ...] sorted
    descending, with one-hot-encoded categorical columns summed back into
    their source field.

    Returns None (never raises) if the underlying estimator doesn't expose
    feature_importances_, so callers can hide the section gracefully.
    """
    try:
        model = pipeline.named_steps[preprocessing.MODEL_STEP_NAME]
        transformed_names = preprocessing.get_transformed_feature_names(pipeline)
        raw_importances = _extract_raw_importances(model)

        aggregated: dict[str, float] = {}
        for name, importance in zip(transformed_names, raw_importances):
            source = _source_column(name)
            aggregated[source] = aggregated.get(source, 0.0) + float(importance)

        pairs = sorted(aggregated.items(), key=lambda item: item[1], reverse=True)
        return pairs
    except Exception:
        logger.warning("Feature importances unavailable for this model.", exc_info=True)
        return None


def display_label(column: str) -> str:
    """Human-readable label for a dataset column, from feature_schema.py."""
    return FIELD_SCHEMA.get(column, {}).get("label", column)


def build_explanation(pairs: list[tuple[str, float]] | None, top_n: int = 2) -> str:
    """Beginner-friendly one-line summary naming the top contributing features."""
    if not pairs:
        return "Feature importance data isn't available for this model."

    labels = [display_label(col) for col, _ in pairs[:top_n]]
    joined = labels[0] if len(labels) == 1 else f"{', '.join(labels[:-1])} and {labels[-1]}"
    return f"Your {joined} contributed the most to this prediction."


def explain_feature(column: str, feature_effects: dict | None) -> str:
    """
    Build a single beginner-friendly "why" sentence for one feature, using
    the directional effect computed at training time. Falls back to a
    generic sentence if no effect data is available for that column.
    """
    label = display_label(column)
    effect = (feature_effects or {}).get(column)

    if not effect:
        return f"{label} was one of the features the model weighed most heavily."

    if effect["type"] == "numeric":
        if effect["direction"] == "positive":
            return (
                f"{label} contributed positively because students with a higher "
                f"{label} tended to have better placement outcomes in the "
                f"training data."
            )
        return (
            f"{label} had a negative relationship with placement — students with "
            f"a higher {label} were, on average, placed less often in the "
            f"training data."
        )

    # categorical
    return (
        f"{label} mattered because students with \"{effect['best_category']}\" "
        f"were placed more often than those with \"{effect['worst_category']}\" "
        f"in the training data."
    )


def build_feature_explanations(
    pairs: list[tuple[str, float]] | None,
    feature_effects: dict | None,
    top_n: int = 5,
) -> list[str]:
    """Return a short list of per-feature 'why it mattered' sentences, most important first."""
    if not pairs:
        return []
    return [explain_feature(column, feature_effects) for column, _ in pairs[:top_n]]
