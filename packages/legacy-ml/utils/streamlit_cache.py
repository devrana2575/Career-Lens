"""
streamlit_cache.py
Thin Streamlit-caching wrappers around the framework-agnostic loaders in
src/model_utils.py and src/data_loader.py.

Kept out of src/ deliberately: the backend pipeline (train_model.py,
predict.py, model_utils.py) has no Streamlit dependency and can be
imported/tested from plain Python. This module is the only place that
adds st.cache_resource / st.cache_data on top of it, so pages don't
re-read the model or dataset from disk on every rerun.
"""

import pandas as pd
import streamlit as st

from src import data_loader, model_utils


@st.cache_resource(show_spinner=False)
def get_pipeline():
    """Cached model pipeline — loaded from disk once per server process."""
    return model_utils.load_pipeline()


@st.cache_data(show_spinner=False)
def get_feature_names() -> list[str]:
    return model_utils.load_feature_names()


@st.cache_data(show_spinner=False)
def get_metadata() -> dict | None:
    return model_utils.load_metadata()


@st.cache_data(show_spinner=False)
def get_dataset() -> pd.DataFrame:
    """
    Cached dataset load for the Dataset Explorer page.

    Raises:
        PlacementPredictorError: If the dataset is missing or malformed —
            callers should catch this and show a friendly message.
    """
    return data_loader.load_dataset()
