"""
exceptions.py
Custom exception types so callers (mainly app.py) can show friendly,
specific error messages instead of a raw traceback.
"""


class PlacementPredictorError(Exception):
    """Base class for every project-specific error."""


class DatasetNotFoundError(PlacementPredictorError):
    """Raised when the training CSV is missing from data/."""


class InvalidDatasetSchemaError(PlacementPredictorError):
    """Raised when the dataset exists but is missing required columns."""


class ModelNotFoundError(PlacementPredictorError):
    """Raised when a trained model/feature file is missing from models/."""


class InvalidInputError(PlacementPredictorError):
    """Raised when data passed in for a prediction is missing or malformed."""
