"""
data_loader.py
Loads the placement dataset from disk and validates it against the schema
defined in config.py.

This loader is dataset-agnostic: it doesn't care whether
data/placementdata.csv was produced by scripts/generate_dataset.py (the
synthetic dataset this project ships with) or dropped in from a real
source. Either way, the only requirement is that the CSV contains at
least the columns listed in config.REQUIRED_COLUMNS — nothing else in
the pipeline needs to change.
"""

import pandas as pd

from src import config
from src.exceptions import DatasetNotFoundError, InvalidDatasetSchemaError
from utils.logger import get_logger

logger = get_logger(__name__)


def load_dataset(path=None) -> pd.DataFrame:
    """
    Load and validate the training dataset.

    Args:
        path: Optional override for the CSV location. Defaults to
              config.DATA_PATH.

    Returns:
        A validated pandas DataFrame.

    Raises:
        DatasetNotFoundError: If no CSV exists at the given path.
        InvalidDatasetSchemaError: If required columns are missing.
    """
    csv_path = path or config.DATA_PATH

    if not csv_path.exists():
        raise DatasetNotFoundError(
            f"No dataset found at '{csv_path}'.\n"
            f"Place a CSV there with these columns:\n"
            f"  {config.REQUIRED_COLUMNS}\n"
            f"Then re-run training."
        )

    logger.info("Loading dataset from %s", csv_path)
    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        raise DatasetNotFoundError(
            f"Found a file at '{csv_path}' but couldn't read it as CSV: {exc}"
        ) from exc

    validate_schema(df)
    logger.info("Dataset loaded: %d rows, %d columns", len(df), len(df.columns))
    return df


def validate_schema(df: pd.DataFrame) -> None:
    """
    Ensure the DataFrame has every column the pipeline needs.

    Raises:
        InvalidDatasetSchemaError: If any required column is missing.
    """
    missing = [col for col in config.REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise InvalidDatasetSchemaError(
            f"Dataset is missing required column(s): {missing}\n"
            f"Expected columns: {config.REQUIRED_COLUMNS}\n"
            f"Found columns: {list(df.columns)}"
        )

    if df.empty:
        raise InvalidDatasetSchemaError("Dataset file was found but contains no rows.")
