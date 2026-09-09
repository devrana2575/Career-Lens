"""
pages/2_dataset_explorer.py
Dedicated Dataset Explorer page — lets a user understand the data the
model was trained on: preview, dimensions, missing values, dtypes, class
balance, per-feature distributions, correlations, and descriptive stats.

Read-only: this page never modifies data/placementdata.csv or triggers
training. Dataset loading is cached via utils.streamlit_cache so
navigating back to this page doesn't re-read the CSV from disk.
"""

import streamlit as st

from src import config, dataset_summary, feature_importance, visualizations
from src.exceptions import PlacementPredictorError
from utils import streamlit_cache, ui
from utils.logger import get_logger

logger = get_logger(__name__)

st.set_page_config(
    page_title=f"Dataset Explorer — {config.APP_NAME}", page_icon="🔍", layout="wide",
    initial_sidebar_state="collapsed",
)
ui.inject_css()

ui.page_header(
    "Dataset Explorer",
    "Understand the data behind the model — before trusting its predictions.",
)
st.caption("🔧 Internal developer page — not linked from the main navigation.")

try:
    df = streamlit_cache.get_dataset()
except PlacementPredictorError as exc:
    logger.error("Dataset unavailable: %s", exc)
    st.error(str(exc))
    st.stop()
except Exception:
    logger.exception("Unexpected error loading dataset")
    st.error("Something unexpected went wrong loading the dataset. Please try again.")
    st.stop()

if not config.DATASET_IS_SYNTHETIC:
    ui.disclosure(
        f"This is real, anonymized data — {config.DATASET_NAME}. "
        f"{len(df)} student records, {df.shape[1]} columns."
    )
else:
    ui.disclosure(
        f"This is a synthetic, probability-weighted dataset (not real student "
        f"records) — see scripts/generate_dataset.py for the exact generation "
        f"logic. {len(df)} students, {df.shape[1]} columns."
    )

# ── Interactive filters ──────────────────────────────────────────────
ui.section_header("Interactive Filters")
with st.container(border=True):
    st.caption("Filter the dataset below — every section on this page reacts to your selection.")
    filter_cols = st.columns(4)

    with filter_cols[0]:
        cgpa_range = st.slider(
            "CGPA range", 0.0, 10.0, (0.0, 10.0), 0.1, key="filter_cgpa",
        )
    with filter_cols[1]:
        max_backlogs = st.slider(
            "Max active backlogs", 0, int(df["Active_Backlogs"].max()),
            int(df["Active_Backlogs"].max()), key="filter_backlogs",
        )
    with filter_cols[2]:
        training_filter = st.multiselect(
            "Placement training", options=["Yes", "No"], default=["Yes", "No"],
            key="filter_training",
        )
    with filter_cols[3]:
        status_filter = st.multiselect(
            "Placement status", options=["Placed", "Not Placed"],
            default=["Placed", "Not Placed"], key="filter_status",
        )

    status_values = [1 if s == "Placed" else 0 for s in status_filter] or [0, 1]
    training_values = training_filter or ["Yes", "No"]

    filtered_df = df[
        (df["CGPA"] >= cgpa_range[0]) & (df["CGPA"] <= cgpa_range[1])
        & (df["Active_Backlogs"] <= max_backlogs)
        & (df["Placement_Training"].isin(training_values))
        & (df[config.TARGET_COLUMN].isin(status_values))
    ]

    if filtered_df.empty:
        st.warning("No records match the current filters — every section below will be empty. Try widening a filter.")
    else:
        st.caption(f"Showing **{len(filtered_df)}** of {len(df)} students after filters.")

df = filtered_df  # every section below reacts to the active filter selection

st.write("")

# ── Preview ───────────────────────────────────────────────────────────
ui.section_header("Dataset Preview")
with st.container(border=True):
    if df.empty:
        st.info("No rows to preview with the current filters.")
    else:
        st.dataframe(df.head(20), use_container_width=True)
        rows, cols = dataset_summary.dimensions(df)
        st.caption(f"Showing the first 20 of {rows} rows · {cols} columns total.")

st.write("")

# ── Dimensions & data types ──────────────────────────────────────────
col_dims, col_missing = st.columns(2)

with col_dims:
    ui.section_header("Dimensions & Feature Types")
    with st.container(border=True):
        rows, cols = dataset_summary.dimensions(df)
        m1, m2, m3 = st.columns(3)
        m1.metric("Rows", rows)
        m2.metric("Columns", cols)
        m3.metric("Features", len(config.FEATURE_COLUMNS))
        st.dataframe(dataset_summary.dtype_summary(df), use_container_width=True, hide_index=True)

with col_missing:
    ui.section_header("Missing Values")
    with st.container(border=True):
        missing = dataset_summary.missing_value_summary(df)
        if missing.empty:
            st.success("No missing values in any column.")
        else:
            st.dataframe(missing.rename("Missing Count"), use_container_width=True)
            fig = visualizations.missing_values_bar(missing)
            st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── Target class distribution ────────────────────────────────────────
ui.section_header("Target Class Distribution")
with st.container(border=True):
    if df.empty:
        st.info("No rows match the current filters.")
    else:
        counts = dataset_summary.class_distribution(df)
        total = counts.sum()
        labels = {0: "Not Placed", 1: "Placed"}
        col1, col2 = st.columns([1, 1])
        with col1:
            fig = visualizations.class_distribution_bar(counts, labels)
            st.plotly_chart(fig, use_container_width=True)
        with col2:
            for class_value, count in counts.items():
                label = labels.get(class_value, str(class_value))
                st.metric(label, f"{count} ({count / total * 100:.1f}%)")

st.write("")

# ── Feature distributions ────────────────────────────────────────────
ui.section_header("Feature Distributions")
with st.container(border=True):
    st.caption("Numeric features shown as histograms, categorical features as bar charts.")
    numeric_tab, categorical_tab = st.tabs(["Numeric Features", "Categorical Features"])

    with numeric_tab:
        layout_cols = st.columns(2)
        for i, column in enumerate(config.NUMERIC_FEATURES):
            label = feature_importance.display_label(column)
            with layout_cols[i % 2]:
                fig = visualizations.numeric_histogram(df[column], label)
                st.plotly_chart(fig, use_container_width=True)

    with categorical_tab:
        layout_cols = st.columns(2)
        for i, column in enumerate(config.CATEGORICAL_FEATURES):
            label = feature_importance.display_label(column)
            with layout_cols[i % 2]:
                fig = visualizations.categorical_bar(df[column].value_counts(), label)
                st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── Correlation heatmap ───────────────────────────────────────────────
ui.section_header("Correlation Heatmap")
with st.container(border=True):
    st.caption("Numeric features and the target (PlacementStatus). Categorical features aren't included — correlation isn't meaningful for unordered categories.")
    corr = dataset_summary.correlation_matrix(df)
    fig = visualizations.correlation_heatmap(corr)
    st.plotly_chart(fig, use_container_width=True)

st.write("")

# ── Descriptive statistics ───────────────────────────────────────────
ui.section_header("Descriptive Statistics")
with st.container(border=True):
    st.caption("Numeric features only.")
    st.dataframe(dataset_summary.descriptive_statistics(df), use_container_width=True)

ui.footer()
