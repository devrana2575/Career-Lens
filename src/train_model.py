"""
train_model.py
Run once (or whenever the dataset changes) to train and save the model.

Usage:
    python -m src.train_model

Expects data/placementdata.csv matching the schema in config.py — see
scripts/generate_dataset.py for how it's generated, and data_loader.py
for schema validation.

v2.0 training flow:
  1. Tune Random Forest hyperparameters via RandomizedSearchCV
     (src/hyperparameter_tuning.py), training-split only.
  2. Cross-validate Logistic Regression, Decision Tree, and the *tuned*
     Random Forest for a transparent comparison table
     (src/model_comparison.py) — Random Forest is deployed regardless of
     which candidate tops this table; see model_comparison.py for why.
  3. Fit the tuned Random Forest on the full training split and evaluate
     it once on the held-out test set (confusion matrix, ROC/PR curves,
     classification report) — the test set never touches steps 1-2, to
     avoid leaking test performance into tuning or comparison.
  4. Compute placed-student feature averages for the recommendation
     engine (src/recommendations.py) and directional feature effects for
     explainability (src/feature_importance.py).
"""

import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from src import config, evaluation, hyperparameter_tuning, model_comparison, model_utils, preprocessing
from src.data_loader import load_dataset
from src.exceptions import PlacementPredictorError
from utils.logger import get_logger

logger = get_logger(__name__)


def _compute_feature_effects(df: pd.DataFrame) -> dict:
    """
    Compute a simple, transparent "which direction does this feature push
    predictions?" summary directly from the training data — used later by
    feature_importance.py to explain *why* a feature mattered, not just
    that it did.

    Numeric features: sign of the correlation with placement outcome.
    Categorical features: which category has the highest placement rate.

    This is deliberately simple (plain correlation / group rates) rather
    than a second explainability model — it's meant to be understandable
    to a non-technical reader, not maximally precise.
    """
    effects = {}

    for column in config.NUMERIC_FEATURES:
        correlation = df[column].corr(df[config.TARGET_COLUMN])
        effects[column] = {
            "type": "numeric",
            "direction": "positive" if correlation >= 0 else "negative",
            "correlation": round(float(correlation), 3),
        }

    for column in config.CATEGORICAL_FEATURES:
        placement_rate_by_category = (
            df.groupby(column)[config.TARGET_COLUMN].mean().sort_values(ascending=False)
        )
        effects[column] = {
            "type": "categorical",
            "best_category": str(placement_rate_by_category.index[0]),
            "best_rate": round(float(placement_rate_by_category.iloc[0]), 3),
            "worst_category": str(placement_rate_by_category.index[-1]),
            "worst_rate": round(float(placement_rate_by_category.iloc[-1]), 3),
        }

    return effects


def _compute_placed_averages(df: pd.DataFrame) -> dict:
    """
    Compute average feature values among *placed* students only — used by
    recommendations.py to ground every suggestion in an actual dataset
    statistic ("your internships are below the average placed student")
    rather than a generic rule of thumb.
    """
    placed = df[df[config.TARGET_COLUMN] == 1]
    if placed.empty:
        logger.warning("No placed students in dataset — cannot compute placed_averages")
        return {}

    averages = {
        column: {"mean": round(float(placed[column].mean()), 2)}
        for column in config.NUMERIC_FEATURES
    }
    for column in config.CATEGORICAL_FEATURES:
        # Currently only Placement_Training ("Yes"/"No") — generalized to
        # any Yes/No categorical field without hardcoding the column name.
        yes_rate = (placed[column] == "Yes").mean()
        averages[column] = {"placed_rate": round(float(yes_rate), 3)}

    return averages


def train() -> dict:
    """Run the full training pipeline and return the deployed model's test metrics."""
    df = load_dataset()
    X, y = preprocessing.split_features_target(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_STATE,
        stratify=y,
    )
    logger.info(
        "Split dataset: %d training rows, %d test rows",
        len(X_train), len(X_test),
    )

    # ── Hyperparameter tuning (training split only) ───────────────────────
    tuned_rf_params, tuning_cv_score = hyperparameter_tuning.tune_random_forest(X_train, y_train)

    # ── Model comparison (cross-validated on the training split only) ────
    # For transparency/reporting only — the deployed model is fixed below.
    comparison = model_comparison.compare_models(X_train, y_train, rf_params=tuned_rf_params)
    selection_rationale = model_comparison.build_deployment_rationale(comparison)

    # ── Fit the tuned production model and evaluate once on the held-out
    #    test set ────────────────────────────────────────────────────────
    pipeline = model_comparison.build_deployed_pipeline(rf_params=tuned_rf_params)
    logger.info("Training %s on the full training split...", model_comparison.DEPLOYED_MODEL_NAME)
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    probas = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_test, preds), 4),
        "precision": round(precision_score(y_test, preds), 4),
        "recall": round(recall_score(y_test, preds), 4),
        "f1_score": round(f1_score(y_test, preds), 4),
        "roc_auc": round(roc_auc_score(y_test, probas), 4),
    }

    logger.info("Deployed model : %s", model_comparison.DEPLOYED_MODEL_NAME)
    logger.info("Tuned params   : %s", tuned_rf_params)
    logger.info("Accuracy : %.1f%%", metrics["accuracy"] * 100)
    logger.info("Precision: %.3f", metrics["precision"])
    logger.info("Recall   : %.3f", metrics["recall"])
    logger.info("F1 Score : %.3f", metrics["f1_score"])
    logger.info("ROC-AUC  : %.3f", metrics["roc_auc"])
    logger.info(
        "\n%s",
        classification_report(y_test, preds, target_names=["Not Placed", "Placed"]),
    )

    evaluation_report = evaluation.build_evaluation_report(y_test.to_numpy(), preds, probas)
    transformed_feature_names = preprocessing.get_transformed_feature_names(pipeline)
    feature_effects = _compute_feature_effects(df)
    placed_averages = _compute_placed_averages(df)

    model_utils.save_pipeline(
        pipeline,
        feature_names=X.columns.tolist(),
        transformed_feature_names=transformed_feature_names,
        dataset_size=len(df),
        metrics=metrics,
        feature_effects=feature_effects,
        model_comparison=comparison,
        selection_rationale=selection_rationale,
        evaluation=evaluation_report,
        placed_averages=placed_averages,
        tuned_hyperparameters=tuned_rf_params,
        tuning_cv_score=tuning_cv_score,
    )
    logger.info("Training complete. Run:  streamlit run app.py")
    return metrics


if __name__ == "__main__":
    try:
        train()
    except PlacementPredictorError as exc:
        logger.error(str(exc))
        raise SystemExit(1) from exc
