"""
dataset_summary.py
Pure computation for the Dataset Explorer page: dimensions, missing
values, dtypes, class balance, descriptive statistics, and correlations.

Every function reads columns from config.py rather than hardcoding them,
so this page adapts automatically if the dataset schema changes. No
Streamlit calls here — pages/2_dataset_explorer.py owns rendering.
"""

import pandas as pd

from src import config
from utils.logger import get_logger

logger = get_logger(__name__)


def dimensions(df: pd.DataFrame) -> tuple[int, int]:
    """(row_count, column_count)."""
    return df.shape


def missing_value_summary(df: pd.DataFrame) -> pd.Series:
    """Count of missing values per column, columns with zero missing excluded."""
    counts = df.isna().sum()
    return counts[counts > 0].sort_values(ascending=False)


def dtype_summary(df: pd.DataFrame) -> pd.DataFrame:
    """One row per column: dtype and role (numeric / categorical / target)."""
    roles = {}
    for column in df.columns:
        if column == config.TARGET_COLUMN:
            roles[column] = "target"
        elif column in config.NUMERIC_FEATURES:
            roles[column] = "numeric feature"
        elif column in config.CATEGORICAL_FEATURES:
            roles[column] = "categorical feature"
        else:
            roles[column] = "unused"

    return pd.DataFrame({
        "column": df.columns,
        "dtype": [str(dt) for dt in df.dtypes],
        "role": [roles[c] for c in df.columns],
    })


def class_distribution(df: pd.DataFrame) -> pd.Series:
    """Value counts of the target column."""
    return df[config.TARGET_COLUMN].value_counts().sort_index()


def descriptive_statistics(df: pd.DataFrame) -> pd.DataFrame:
    """describe() over numeric features only, transposed for readability."""
    return df[config.NUMERIC_FEATURES].describe().T.round(2)


def correlation_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Correlation matrix over numeric features + the target column."""
    columns = config.NUMERIC_FEATURES + [config.TARGET_COLUMN]
    return df[columns].corr().round(3)
