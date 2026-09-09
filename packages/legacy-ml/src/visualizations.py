"""
visualizations.py
Visual Components module.

Every Plotly figure used by the dashboard is built here, never inline in
app.py or insights.py. Each function returns a plain go.Figure that the
caller passes straight to st.plotly_chart(..., use_container_width=True)
so charts stay responsive at any panel width.
"""

import pandas as pd
import plotly.graph_objects as go

_GRID_COLOR = "#334155"
_AXIS_LABEL_COLOR = "#cbd5e1"


def readiness_gauge(score: int) -> go.Figure:
    """Career Readiness Score gauge (0-100), colour-coded by band."""
    if score >= 85:
        color = "#a78bfa"
    elif score >= 70:
        color = "#60a5fa"
    elif score >= 50:
        color = "#fbbf24"
    else:
        color = "#f87171"

    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=score,
        number={"suffix": " / 100", "font": {"size": 36, "color": "#e2e8f0"}},
        title={"text": "Career Readiness Score", "font": {"size": 18, "color": _AXIS_LABEL_COLOR}},
        gauge={
            "axis": {"range": [0, 100], "tickfont": {"size": 13, "color": _AXIS_LABEL_COLOR}},
            "bar": {"thickness": 0.3, "color": color},
            "bgcolor": "#0f172a",
            "bordercolor": "#334155",
            "steps": [
                {"range": [0, 50], "color": "#3f1d1d"},
                {"range": [50, 70], "color": "#3f321a"},
                {"range": [70, 85], "color": "#16243f"},
                {"range": [85, 100], "color": "#2c1e42"},
            ],
        },
    ))
    fig.update_layout(
        height=300,
        margin=dict(l=30, r=30, t=60, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def feature_importance_bar(labeled_pairs: list[tuple[str, float]], top_n: int = 8) -> go.Figure:
    """
    Horizontal bar chart of the top contributing features, sorted with the
    most influential feature at the top.

    Args:
        labeled_pairs: [(display_label, importance), ...] — importance as
            a raw 0-1 fraction. Sorted descending by importance internally,
            capped to top_n, then reversed for correct top-down rendering
            (Plotly draws horizontal bars bottom-to-top).
    """
    ranked = sorted(labeled_pairs, key=lambda item: item[1], reverse=True)[:top_n]
    ordered = list(reversed(ranked))
    labels = [label for label, _ in ordered]
    values = [round(value * 100, 1) for _, value in ordered]

    fig = go.Figure(go.Bar(
        x=values,
        y=labels,
        orientation="h",
        marker=dict(color="#2563eb"),
        text=[f"{v}%" for v in values],
        textposition="outside",
        textfont=dict(size=13, color=_AXIS_LABEL_COLOR),
        hovertemplate="%{y}: %{x}%<extra></extra>",
    ))
    fig.update_layout(
        height=max(320, 52 * len(labels)),
        bargap=0.45,
        margin=dict(l=20, r=60, t=20, b=40),
        xaxis_title="Relative Influence on Prediction (%)",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(showgrid=True, gridcolor=_GRID_COLOR, range=[0, max(values) * 1.3 if values else 1]),
        yaxis=dict(automargin=True, tickfont=dict(size=13, color=_AXIS_LABEL_COLOR)),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig


# ── Model Evaluation page ────────────────────────────────────────────────
def confusion_matrix_heatmap(matrix: list[list[int]], labels: list[str]) -> go.Figure:
    """Annotated confusion matrix heatmap (rows = actual, columns = predicted)."""
    fig = go.Figure(go.Heatmap(
        z=matrix,
        x=[f"Predicted: {label}" for label in labels],
        y=[f"Actual: {label}" for label in labels],
        colorscale=[[0, "#1e293b"], [1, "#6366f1"]],
        showscale=False,
        text=matrix,
        texttemplate="%{text}",
        textfont={"size": 22, "color": "#f8fafc"},
        hovertemplate="%{y} / %{x}: %{z}<extra></extra>",
    ))
    fig.update_layout(
        height=340,
        margin=dict(l=10, r=10, t=10, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(autorange="reversed"),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig


def roc_curve_chart(fpr: list[float], tpr: list[float], auc: float) -> go.Figure:
    """ROC curve with a diagonal no-skill reference line and the AUC in the title."""
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=fpr, y=tpr, mode="lines", name="ROC Curve",
        line=dict(color="#2563eb", width=3),
        fill="tozeroy", fillcolor="rgba(37,99,235,0.08)",
    ))
    fig.add_trace(go.Scatter(
        x=[0, 1], y=[0, 1], mode="lines", name="Random Guess",
        line=dict(color="#cbd5e1", width=2, dash="dash"),
    ))
    fig.update_layout(
        title=dict(text=f"ROC Curve (AUC = {auc:.3f})", font=dict(size=16, color=_AXIS_LABEL_COLOR)),
        xaxis_title="False Positive Rate",
        yaxis_title="True Positive Rate",
        height=360,
        margin=dict(l=40, r=20, t=50, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(range=[0, 1], showgrid=True, gridcolor=_GRID_COLOR),
        yaxis=dict(range=[0, 1.02], showgrid=True, gridcolor=_GRID_COLOR),
        font=dict(color=_AXIS_LABEL_COLOR),
        legend=dict(orientation="h", yanchor="bottom", y=-0.3),
    )
    return fig


def precision_recall_curve_chart(precision: list[float], recall: list[float]) -> go.Figure:
    """Precision-Recall curve."""
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=recall, y=precision, mode="lines", name="Precision-Recall",
        line=dict(color="#16a34a", width=3),
        fill="tozeroy", fillcolor="rgba(22,163,74,0.08)",
    ))
    fig.update_layout(
        title=dict(text="Precision-Recall Curve", font=dict(size=16, color=_AXIS_LABEL_COLOR)),
        xaxis_title="Recall",
        yaxis_title="Precision",
        height=360,
        margin=dict(l=40, r=20, t=50, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(range=[0, 1], showgrid=True, gridcolor=_GRID_COLOR),
        yaxis=dict(range=[0, 1.02], showgrid=True, gridcolor=_GRID_COLOR),
        font=dict(color=_AXIS_LABEL_COLOR),
        showlegend=False,
    )
    return fig


def model_comparison_bar(comparison: dict[str, dict[str, dict[str, float]]], metric: str) -> go.Figure:
    """Grouped bar comparing one CV metric (with std-dev error bars) across every candidate model."""
    names = list(comparison.keys())
    means = [round(comparison[name][metric]["mean"] * 100, 1) for name in names]
    stds = [round(comparison[name][metric]["std"] * 100, 1) for name in names]

    fig = go.Figure(go.Bar(
        x=names, y=means,
        error_y=dict(type="data", array=stds, visible=True, color="#64748b"),
        marker=dict(color=["#2563eb", "#7c3aed", "#0891b2"][: len(names)]),
        text=[f"{v}%" for v in means],
        textposition="outside",
    ))
    fig.update_layout(
        height=320,
        margin=dict(l=20, r=20, t=30, b=20),
        yaxis_title=f"{metric.replace('_', ' ').upper()} (%, ± 1 std across CV folds)",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(range=[0, 110], showgrid=True, gridcolor=_GRID_COLOR),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig


# ── Profile Analytics ─────────────────────────────────────────────────
def missing_values_bar(missing_counts: pd.Series) -> go.Figure:
    """Horizontal bar of missing-value counts per column (empty if none missing)."""
    fig = go.Figure(go.Bar(
        x=missing_counts.values,
        y=missing_counts.index,
        orientation="h",
        marker=dict(color="#dc2626"),
    ))
    fig.update_layout(
        height=max(200, 32 * len(missing_counts)),
        margin=dict(l=10, r=20, t=10, b=10),
        xaxis_title="Missing Values",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(showgrid=True, gridcolor=_GRID_COLOR),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig


def class_distribution_bar(counts: pd.Series, labels: dict[int, str] | None = None) -> go.Figure:
    """Bar chart of target class counts."""
    labels = labels or {}
    x_labels = [labels.get(idx, str(idx)) for idx in counts.index]

    fig = go.Figure(go.Bar(
        x=x_labels, y=counts.values,
        marker=dict(color=["#dc2626", "#16a34a"][: len(counts)]),
        text=counts.values,
        textposition="outside",
    ))
    fig.update_layout(
        height=300,
        margin=dict(l=20, r=20, t=20, b=20),
        yaxis_title="Number of Students",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(showgrid=True, gridcolor=_GRID_COLOR),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig


def numeric_histogram(series: pd.Series, label: str) -> go.Figure:
    """Histogram for one numeric feature's distribution."""
    fig = go.Figure(go.Histogram(x=series, marker=dict(color="#2563eb"), nbinsx=20))
    fig.update_layout(
        title=dict(text=label, font=dict(size=14, color=_AXIS_LABEL_COLOR)),
        height=280,
        margin=dict(l=30, r=20, t=40, b=30),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(showgrid=True, gridcolor=_GRID_COLOR),
        yaxis=dict(showgrid=True, gridcolor=_GRID_COLOR, title="Count"),
        font=dict(color=_AXIS_LABEL_COLOR),
        bargap=0.05,
    )
    return fig


def categorical_bar(counts: pd.Series, label: str) -> go.Figure:
    """Bar chart of value counts for one categorical feature."""
    fig = go.Figure(go.Bar(
        x=counts.index.astype(str), y=counts.values,
        marker=dict(color="#7c3aed"),
        text=counts.values,
        textposition="outside",
    ))
    fig.update_layout(
        title=dict(text=label, font=dict(size=14, color=_AXIS_LABEL_COLOR)),
        height=280,
        margin=dict(l=30, r=20, t=40, b=30),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(showgrid=True, gridcolor=_GRID_COLOR, title="Count"),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig


def correlation_heatmap(corr: pd.DataFrame) -> go.Figure:
    """Correlation heatmap for numeric features + target."""
    fig = go.Figure(go.Heatmap(
        z=corr.values,
        x=corr.columns,
        y=corr.columns,
        colorscale=[[0, "#1d4ed8"], [0.5, "#1e293b"], [1, "#b91c1c"]],
        zmid=0,
        zmin=-1, zmax=1,
        text=[[f"{v:.2f}" for v in row] for row in corr.values],
        texttemplate="%{text}",
        textfont={"size": 11, "color": "#f8fafc"},
        hovertemplate="%{y} / %{x}: %{z:.3f}<extra></extra>",
    ))
    fig.update_layout(
        height=max(360, 46 * len(corr.columns)),
        margin=dict(l=10, r=10, t=10, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(autorange="reversed"),
        font=dict(color=_AXIS_LABEL_COLOR),
    )
    return fig
