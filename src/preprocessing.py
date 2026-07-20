"""
preprocessing.py
Reusable preprocessing logic shared by both training and prediction, so the
exact same transformations are guaranteed at inference time as at training
time.

The dataset mixes numeric fields (CGPA, marks, counts) with one
categorical field (Placement_Training), so preprocessing is a
ColumnTransformer: numeric columns are standardized, the categorical
column is one-hot encoded. Everything downstream (train_model.py,
predict.py, feature_importance.py) reads the column groupings from
config.py rather than hardcoding them here.
"""

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src import config

PREPROCESSING_STEP_NAME = "preprocessing"
MODEL_STEP_NAME = "model"


def split_features_target(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Split a validated DataFrame into (X, y) using the configured schema."""
    X = df[config.FEATURE_COLUMNS].copy()
    y = df[config.TARGET_COLUMN].copy()
    return X, y


def build_preprocessing_transformer() -> ColumnTransformer:
    """
    Build the preprocessing step as a standalone, reusable ColumnTransformer.

    Kept separate from the model step so preprocessing can be inspected,
    tested, or swapped independently of whichever estimator is used.
    Unknown categories at inference time are ignored (encoded as all-zero)
    rather than raising, so a single unseen category can't crash a live
    prediction.
    """
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), config.NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", drop=None),
                config.CATEGORICAL_FEATURES,
            ),
        ]
    )


def build_full_pipeline(model) -> Pipeline:
    """Combine preprocessing with a given estimator into one fit/predict pipeline."""
    return Pipeline(steps=[
        (PREPROCESSING_STEP_NAME, build_preprocessing_transformer()),
        (MODEL_STEP_NAME, model),
    ])


def get_transformed_feature_names(pipeline: Pipeline) -> list[str]:
    """
    Return the expanded column names produced by the fitted preprocessing
    step (e.g. numeric columns unchanged, categorical columns exploded into
    one-hot columns like "Work_Experience_Yes"). Used by
    feature_importance.py to map RandomForest's per-column importances back
    to something explainable, since those importances are computed on the
    *post*-encoding columns, not the original 11 input fields.
    """
    preprocessor = pipeline.named_steps[PREPROCESSING_STEP_NAME]
    raw_names = preprocessor.get_feature_names_out()
    # sklearn prefixes names with the transformer name ("num__", "cat__");
    # strip that prefix since it's an implementation detail, not something
    # any downstream module should need to know about.
    return [name.split("__", 1)[-1] for name in raw_names]
