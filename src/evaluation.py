"""
evaluation.py
Computes the full model-evaluation report from a fitted model's held-out
test predictions: confusion matrix, ROC curve, Precision-Recall curve, and
classification report.

Pure computation only — everything here returns plain dicts/lists so it's
JSON-serializable straight into training_metadata.json. Rendering lives in
src/visualizations.py and pages/1_model_evaluation.py.
"""

from typing import Any

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_curve, roc_curve

from utils.logger import get_logger

logger = get_logger(__name__)

_TARGET_NAMES = ["Not Placed", "Placed"]


def build_evaluation_report(
    y_test: np.ndarray, preds: np.ndarray, probas: np.ndarray
) -> dict[str, Any]:
    """
    Build the full evaluation report for one fitted model's test-set
    predictions.

    Returns:
        {
            "confusion_matrix": [[tn, fp], [fn, tp]],
            "roc_curve": {"fpr": [...], "tpr": [...]},
            "pr_curve": {"precision": [...], "recall": [...]},
            "classification_report": {class/avg: {precision, recall, f1-score, support}, ...},
        }
    """
    cm = confusion_matrix(y_test, preds).tolist()

    fpr, tpr, _ = roc_curve(y_test, probas)
    precision, recall, _ = precision_recall_curve(y_test, probas)

    report = classification_report(
        y_test, preds, target_names=_TARGET_NAMES, output_dict=True, zero_division=0
    )

    logger.info("Evaluation report computed on %d held-out test rows", len(y_test))
    return {
        "confusion_matrix": cm,
        "confusion_matrix_labels": _TARGET_NAMES,
        "roc_curve": {"fpr": fpr.tolist(), "tpr": tpr.tolist()},
        "pr_curve": {"precision": precision.tolist(), "recall": recall.tolist()},
        "classification_report": report,
    }
