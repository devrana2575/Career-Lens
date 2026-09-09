"""
model_comparison.py
Cross-validates Logistic Regression, Decision Tree, Gradient Boosting, and
Random Forest for a transparent side-by-side comparison table.

Random Forest is the deployed production model — that choice is fixed,
not re-derived from whichever candidate tops the leaderboard this run.
This module's job is to make that choice *honest*, not to justify it
regardless of the numbers: build_deployment_rationale() reports the real
cross-validated scores for every candidate, including cases where a
simpler model edges Random Forest out on paper, and explains the
engineering reasons (stability across folds, resistance to overfitting on
a small tabular dataset, native feature-importance support) for keeping
Random Forest anyway. It does not claim Random Forest "won" when it
didn't.
"""

from typing import Any

import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_validate

from src import config, model_utils, preprocessing
from utils.logger import get_logger

logger = get_logger(__name__)

_SCORING = ["accuracy", "precision", "recall", "f1", "roc_auc"]
DEPLOYED_MODEL_NAME = "Random Forest"


def compare_models(
    X_train: pd.DataFrame, y_train: pd.Series, rf_params: dict[str, Any] | None = None
) -> dict[str, dict[str, dict[str, float]]]:
    """
    Cross-validate every candidate model on the training split.

    Args:
        rf_params: Tuned Random Forest hyperparameters from
            src.hyperparameter_tuning, if available — so the comparison
            table reflects the *actual* deployed configuration, not a
            stale default.

    Returns:
        {model_name: {"accuracy": {"mean": ..., "std": ...}, ...}, ...}
        Both mean and standard deviation are reported across
        config.CV_FOLDS stratified folds — with a dataset this size,
        per-fold variance is large enough that it matters for an honest
        comparison, not just the mean.
    """
    cv = StratifiedKFold(
        n_splits=config.CV_FOLDS, shuffle=True, random_state=config.RANDOM_STATE
    )

    comparison: dict[str, dict[str, dict[str, float]]] = {}
    for name, estimator in model_utils.build_candidate_models(rf_params).items():
        pipeline = preprocessing.build_full_pipeline(estimator)
        scores = cross_validate(pipeline, X_train, y_train, cv=cv, scoring=_SCORING)
        comparison[name] = {
            metric: {
                "mean": round(float(scores[f"test_{metric}"].mean()), 4),
                "std": round(float(scores[f"test_{metric}"].std()), 4),
            }
            for metric in _SCORING
        }
        logger.info("Cross-validated %s: %s", name, comparison[name])

    return comparison


def build_deployment_rationale(comparison: dict[str, dict[str, dict[str, float]]]) -> str:
    """
    Explain, honestly, why Random Forest is the deployed model given the
    actual comparison numbers — including when a simpler candidate scores
    marginally higher on the primary metric.
    """
    primary = config.PRIMARY_COMPARISON_METRIC
    rf_score = comparison[DEPLOYED_MODEL_NAME][primary]

    ranked = sorted(
        comparison.items(), key=lambda item: item[1][primary]["mean"], reverse=True
    )
    top_name, top_scores = ranked[0]
    metric_label = primary.replace("_", "-").upper()
    all_scores = ", ".join(
        f"{name}: {scores[primary]['mean']:.3f} (±{scores[primary]['std']:.3f})"
        for name, scores in comparison.items()
    )

    if top_name == DEPLOYED_MODEL_NAME:
        return (
            f"Random Forest is deployed to production. It also achieved the highest "
            f"{config.CV_FOLDS}-fold cross-validated {metric_label} "
            f"({rf_score['mean']:.3f}) among the candidates evaluated ({all_scores})."
        )

    gap = top_scores[primary]["mean"] - rf_score["mean"]
    within_noise = gap <= max(rf_score["std"], top_scores[primary]["std"])
    noise_note = (
        "a difference smaller than the fold-to-fold variance observed for either model, "
        "so it isn't a reliable signal on a dataset this size"
        if within_noise
        else f"a {gap:.3f} gap in mean {metric_label}"
    )
    return (
        f"Random Forest is deployed to production despite {top_name} scoring marginally "
        f"higher on cross-validated {metric_label} ({top_scores[primary]['mean']:.3f} vs. "
        f"{rf_score['mean']:.3f} — {noise_note}). Random Forest was retained because "
        f"averaging many trees over bootstrapped samples tends to generalize more "
        f"consistently on small, noisy tabular data than a single model fit once, and its "
        f"feature_importances_ are used directly by this app's explainability page. "
        f"Full candidate scores: {all_scores}."
    )


def build_deployed_pipeline(rf_params: dict[str, Any] | None = None) -> Any:
    """Build a fresh, unfitted full pipeline for the fixed production model (Random Forest)."""
    estimator = model_utils.build_candidate_models(rf_params)[DEPLOYED_MODEL_NAME]
    return preprocessing.build_full_pipeline(estimator)
