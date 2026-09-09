"""
hyperparameter_tuning.py
Tunes the deployed Random Forest's hyperparameters via RandomizedSearchCV
before it's fit and evaluated. Runs once per `python -m src.train_model`
call, entirely on the training split (never touches the held-out test
set), scored on ROC-AUC.

Kept separate from model_comparison.py: this module answers "what are the
best settings for Random Forest specifically", while model_comparison.py
answers "how does a well-tuned Random Forest stack up against other
algorithms" — two different questions that happen to both use
cross-validation.
"""

from typing import Any

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold

from src import config, preprocessing
from utils.logger import get_logger

logger = get_logger(__name__)


def tune_random_forest(X_train: pd.DataFrame, y_train: pd.Series) -> tuple[dict[str, Any], float]:
    """
    Randomized hyperparameter search over config.HYPERPARAMETER_SEARCH_SPACE.

    Returns:
        (best_params, best_cv_roc_auc) — best_params uses plain
        RandomForestClassifier constructor argument names (no "model__"
        pipeline prefix), ready to pass straight into
        model_utils.build_candidate_models(rf_params=...).
    """
    base_estimator = RandomForestClassifier(
        class_weight="balanced",
        random_state=config.RANDOM_STATE,
        n_jobs=-1,
    )
    pipeline = preprocessing.build_full_pipeline(base_estimator)

    param_distributions = {
        f"{preprocessing.MODEL_STEP_NAME}__{param}": values
        for param, values in config.HYPERPARAMETER_SEARCH_SPACE.items()
    }
    cv = StratifiedKFold(
        n_splits=config.HYPERPARAMETER_SEARCH_CV_FOLDS,
        shuffle=True,
        random_state=config.RANDOM_STATE,
    )

    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_distributions,
        n_iter=config.HYPERPARAMETER_SEARCH_ITER,
        scoring="roc_auc",
        cv=cv,
        random_state=config.RANDOM_STATE,
        n_jobs=-1,
    )

    logger.info(
        "Running RandomizedSearchCV: %d candidates x %d folds...",
        config.HYPERPARAMETER_SEARCH_ITER, config.HYPERPARAMETER_SEARCH_CV_FOLDS,
    )
    search.fit(X_train, y_train)

    best_params = {
        param.split("__", 1)[-1]: value for param, value in search.best_params_.items()
    }
    best_score = round(float(search.best_score_), 4)
    logger.info("Best hyperparameters: %s (CV ROC-AUC=%.4f)", best_params, best_score)

    return best_params, best_score
