"""
model_utils.py
Everything related to building, saving, and loading the model artifacts.
Keeping this separate means train_model.py and predict.py never touch
joblib or file paths directly.
"""

import json
from datetime import datetime, timezone
from typing import Any

import joblib
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier

from src import config
from src.exceptions import ModelNotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)


def build_model(rf_params: dict[str, Any] | None = None) -> RandomForestClassifier:
    """Construct a RandomForestClassifier using tuned params, or config.py's defaults."""
    return RandomForestClassifier(**(rf_params or config.RF_PARAMS))


def build_candidate_models(rf_params: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Construct every candidate estimator considered during training.

    src.model_comparison cross-validates each of these for a transparency
    table — the set here is the full list of "what's in the running", not
    a prediction of the winner. Random Forest is always the deployed
    model regardless of comparison results (see
    model_comparison.DEPLOYED_MODEL_NAME); rf_params lets the *deployed*
    Random Forest use tuned hyperparameters from
    src.hyperparameter_tuning while still appearing in the comparison
    table on equal footing.
    """
    return {
        "Logistic Regression": LogisticRegression(**config.LOGISTIC_REGRESSION_PARAMS),
        "Decision Tree": DecisionTreeClassifier(**config.DECISION_TREE_PARAMS),
        "Gradient Boosting": GradientBoostingClassifier(**config.GRADIENT_BOOSTING_PARAMS),
        "Random Forest": build_model(rf_params),
    }


def model_exists() -> bool:
    """Check whether every required model artifact is present on disk."""
    return (
        config.MODEL_PATH.exists()
        and config.FEATURE_NAMES_PATH.exists()
        and config.TRANSFORMED_FEATURE_NAMES_PATH.exists()
    )


def save_pipeline(
    pipeline,
    feature_names: list[str],
    transformed_feature_names: list[str],
    dataset_size: int,
    metrics: dict[str, float] | None = None,
    feature_effects: dict[str, Any] | None = None,
    model_comparison: dict[str, Any] | None = None,
    selection_rationale: str | None = None,
    evaluation: dict[str, Any] | None = None,
    placed_averages: dict[str, Any] | None = None,
    tuned_hyperparameters: dict[str, Any] | None = None,
    tuning_cv_score: float | None = None,
) -> None:
    """
    Persist the trained pipeline and every artifact the app needs to
    describe it later: raw input column order, post-encoding column
    names (for explainability), and a training metadata JSON file.

    model_comparison / selection_rationale / evaluation / placed_averages
    / tuned_hyperparameters are optional so this function still works for
    a simpler training run.
    """
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(pipeline, config.MODEL_PATH)
    joblib.dump(feature_names, config.FEATURE_NAMES_PATH)
    joblib.dump(transformed_feature_names, config.TRANSFORMED_FEATURE_NAMES_PATH)
    logger.info("Saved pipeline to %s", config.MODEL_PATH)
    logger.info("Saved feature names to %s", config.FEATURE_NAMES_PATH)
    logger.info("Saved transformed feature names to %s", config.TRANSFORMED_FEATURE_NAMES_PATH)

    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_type": type(pipeline.named_steps["model"]).__name__,
        "model_version": config.MODEL_VERSION,
        "hyperparameters": {
            k: v for k, v in pipeline.named_steps["model"].get_params().items()
            if isinstance(v, (str, int, float, bool, type(None)))
        },
        "tuned_hyperparameters": tuned_hyperparameters or {},
        "tuning_cv_score": tuning_cv_score,
        "feature_columns": feature_names,
        "num_features": len(feature_names),
        "dataset_name": config.DATASET_NAME,
        "dataset_size": dataset_size,
        "dataset_is_synthetic": config.DATASET_IS_SYNTHETIC,
        "metrics": metrics or {},
        "feature_effects": feature_effects or {},
        "model_comparison": model_comparison or {},
        "selection_rationale": selection_rationale or "",
        "comparison_metric": config.PRIMARY_COMPARISON_METRIC,
        "placed_averages": placed_averages or {},
        "cv_folds": config.CV_FOLDS,
        "evaluation": evaluation or {},
    }
    with open(config.METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info("Saved training metadata to %s", config.METADATA_PATH)


def load_pipeline():
    """
    Load the trained sklearn Pipeline from disk.

    Raises:
        ModelNotFoundError: If the model artifact is missing.
    """
    if not config.MODEL_PATH.exists():
        raise ModelNotFoundError(
            f"No trained model found at '{config.MODEL_PATH}'.\n"
            f"Run training first:  python -m src.train_model"
        )
    try:
        return joblib.load(config.MODEL_PATH)
    except Exception as exc:
        raise ModelNotFoundError(
            f"Found a file at '{config.MODEL_PATH}' but couldn't load it: {exc}"
        ) from exc


def load_feature_names() -> list[str]:
    """
    Load the saved raw input column order used to build a prediction row.

    Raises:
        ModelNotFoundError: If the feature-names file is missing.
    """
    return _load_pickled_list(config.FEATURE_NAMES_PATH, "feature names")


def load_transformed_feature_names() -> list[str]:
    """
    Load the saved post-encoding column names (numeric columns unchanged,
    categorical columns expanded), used to label feature importances.

    Raises:
        ModelNotFoundError: If the file is missing.
    """
    return _load_pickled_list(config.TRANSFORMED_FEATURE_NAMES_PATH, "transformed feature names")


def load_metadata() -> dict[str, Any] | None:
    """Best-effort read of training metadata. Returns None if unavailable."""
    try:
        with open(config.METADATA_PATH) as f:
            return json.load(f)
    except Exception:
        logger.warning("Training metadata unavailable at %s", config.METADATA_PATH)
        return None


def _load_pickled_list(path, description: str) -> list[str]:
    """Shared loader for the small joblib-pickled list artifacts."""
    if not path.exists():
        raise ModelNotFoundError(
            f"No {description} file found at '{path}'.\n"
            f"Run training first:  python -m src.train_model"
        )
    try:
        return joblib.load(path)
    except Exception as exc:
        raise ModelNotFoundError(
            f"Found a file at '{path}' but couldn't load it: {exc}"
        ) from exc
