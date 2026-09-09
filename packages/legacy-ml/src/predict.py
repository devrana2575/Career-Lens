"""
predict.py
The only function the UI layer needs: predict(student_data).
Everything else — loading the model, building the feature row, validating
input — stays hidden inside this module.

Row-building and validation are driven entirely by
feature_schema.FIELD_SCHEMA + config.NUMERIC_FEATURES/CATEGORICAL_FEATURES
instead of a hardcoded per-field mapping, so swapping datasets only
requires editing config.py + feature_schema.py.
"""

from typing import Any

import pandas as pd

from src import config, model_utils
from src.exceptions import InvalidInputError
from src.feature_schema import FIELD_SCHEMA
from utils.logger import get_logger

logger = get_logger(__name__)

# Model + feature names are loaded once per process and reused, so the app
# never re-reads the pickle files on every prediction.
_pipeline_cache = None
_feature_names_cache = None

# Confidence bands: how far the predicted probability sits from the 50%
# decision boundary, expressed as its own 0-100 scale (a 50% probability
# is 0% confident; a 0% or 100% probability is maximally confident).
_HIGH_CONFIDENCE_THRESHOLD = 60.0
_MEDIUM_CONFIDENCE_THRESHOLD = 30.0

# Risk Level bands: a plain-language read of the placement probability
# itself (not a separate model) — "how much risk does this student carry
# of not being placed", mirrored directly from the same probability shown
# everywhere else in the report.
_LOW_RISK_THRESHOLD = 70.0
_MEDIUM_RISK_THRESHOLD = 40.0


def _get_pipeline():
    global _pipeline_cache
    if _pipeline_cache is None:
        _pipeline_cache = model_utils.load_pipeline()
    return _pipeline_cache


def _get_feature_names():
    global _feature_names_cache
    if _feature_names_cache is None:
        _feature_names_cache = model_utils.load_feature_names()
    return _feature_names_cache


def _decode_and_validate(column: str, raw_value: Any) -> Any:
    """
    Convert one raw student_data value into its model-ready form, validated
    against the bounds/options declared in FIELD_SCHEMA.

    Categorical columns are returned as-is (as a validated string) — the
    pipeline's OneHotEncoder handles the actual encoding. Numeric columns
    are cast and range-checked.
    """
    meta = FIELD_SCHEMA[column]

    if column in config.CATEGORICAL_FEATURES:
        options = meta.get("options", [])
        if raw_value not in options:
            raise InvalidInputError(
                f"'{meta['label']}' must be one of {options}, got: {raw_value!r}"
            )
        return raw_value

    try:
        value = meta["dtype"](raw_value)
    except (TypeError, ValueError) as exc:
        raise InvalidInputError(
            f"'{meta['label']}' must be a number, got: {raw_value!r}"
        ) from exc

    if "min" in meta and value < meta["min"]:
        raise InvalidInputError(
            f"'{meta['label']}' cannot be less than {meta['min']}, got: {value}"
        )
    if "max" in meta and value > meta["max"]:
        raise InvalidInputError(
            f"'{meta['label']}' cannot exceed {meta['max']}, got: {value}"
        )
    return value


def validate_student_input(student_data: dict) -> None:
    """
    Validate that student_data has every required field, and that each
    value is within the range/options declared in FIELD_SCHEMA.

    Raises:
        InvalidInputError: On the first missing or out-of-range field.
    """
    if not isinstance(student_data, dict):
        raise InvalidInputError("student_data must be a dictionary of form values.")

    missing = [col for col in config.FEATURE_COLUMNS if col not in student_data]
    if missing:
        raise InvalidInputError(f"Missing required field(s): {missing}")

    for column in config.FEATURE_COLUMNS:
        _decode_and_validate(column, student_data[column])


def _build_feature_row(student_data: dict, feature_names: list[str]) -> pd.DataFrame:
    """Convert raw form values into the exact column order the model expects."""
    row = {
        column: _decode_and_validate(column, student_data[column])
        for column in config.FEATURE_COLUMNS
    }
    return pd.DataFrame([row])[feature_names]


def _confidence_from_probability(probability: float) -> tuple[float, str]:
    """
    Derive a "how sure is the model" confidence score from the raw
    placement probability, independent of which class it favors.

    A probability of exactly 50% carries no information (a coin flip), so
    confidence there is 0%. A probability of 0% or 100% is maximally
    confident. This is a simple, honest transformation of the model's own
    output — not a second model.
    """
    confidence = round(abs(probability - 50.0) * 2, 1)
    if confidence >= _HIGH_CONFIDENCE_THRESHOLD:
        label = "High Confidence"
    elif confidence >= _MEDIUM_CONFIDENCE_THRESHOLD:
        label = "Medium Confidence"
    else:
        label = "Low Confidence"
    return confidence, label


def _risk_level_from_probability(probability: float) -> tuple[str, str]:
    """
    Derive a plain-language Risk Level (of *not* being placed) from the
    placement probability — a low probability means high risk. Purely a
    relabeling of the same probability the rest of the report shows, not
    a second model.

    Returns (label, color_hex).
    """
    if probability >= _LOW_RISK_THRESHOLD:
        return "Low Risk", "#16a34a"
    if probability >= _MEDIUM_RISK_THRESHOLD:
        return "Medium Risk", "#d97706"
    return "High Risk", "#dc2626"


def get_model_artifacts() -> tuple[Any, list[str]]:
    """
    Return the (pipeline, feature_names) pair used internally by predict(),
    reusing the same process-level cache. Lets dashboard modules (e.g.
    feature_importance.py) read the trained estimator without duplicating
    load logic or bypassing model_utils.

    Raises:
        ModelNotFoundError: If the model hasn't been trained yet.
    """
    return _get_pipeline(), _get_feature_names()


def predict(student_data: dict) -> dict:
    """
    Predict placement outcome for a single student.

    Args:
        student_data: dict keyed by dataset column name (see
            config.FEATURE_COLUMNS / feature_schema.FIELD_SCHEMA for the
            exact keys, types, and valid ranges).

    Returns:
        {
            "placed": bool,
            "probability": float,       # 0-100, P(placed)
            "confidence": float,        # 0-100, how far from a coin flip
            "confidence_label": str,    # "High"/"Medium"/"Low Confidence"
            "risk_level": str,          # "Low"/"Medium"/"High Risk"
            "risk_color": str,          # hex color matching risk_level
        }

    Raises:
        InvalidInputError: If student_data is missing or has malformed fields.
        ModelNotFoundError: If the model hasn't been trained yet.
    """
    validate_student_input(student_data)

    pipeline = _get_pipeline()
    feature_names = _get_feature_names()
    row = _build_feature_row(student_data, feature_names)

    probability = round(float(pipeline.predict_proba(row)[0][1]) * 100, 1)
    placed = probability >= config.PLACEMENT_THRESHOLD
    confidence, confidence_label = _confidence_from_probability(probability)
    risk_label, risk_color = _risk_level_from_probability(probability)

    logger.info(
        "Prediction made | probability=%.1f | placed=%s | confidence=%.1f | risk=%s",
        probability, placed, confidence, risk_label,
    )
    return {
        "placed": placed,
        "probability": probability,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "risk_level": risk_label,
        "risk_color": risk_color,
    }
