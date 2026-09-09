# Legacy-ML — Placement-Intelligence (preserved)

This package contains the **original Placement-Intelligence application** as audited and relocated from the repository root.

It is preserved because it contains high-quality, reusable engineering (see below) and remains runnable as a standalone **legacy analytics tool**. It is **not** the product core of the new Career Intelligence Platform. See `docs/migration.md` for the full migration decision log.

## What's here

- `app.py` — Streamlit dashboard: input form + placement prediction + analytics report.
- `src/` — config, feature schema, preprocessing, training, evaluation, prediction, career-readiness score, recommendations, insights, visualizations, dataset summary.
- `pages/` — internal model-evaluation and dataset-explorer developer pages.
- `utils/` — shared CSS/UI helpers, caching layer, logger.
- `scripts/generate_dataset.py` — synthetic dataset generator (15,000 rows, probability-weighted).
- `notebooks/` — historical EDA/prototype notebook (stale vs production schema).
- `models/` — trained RandomForest pipeline + metadata (version 3.0.0).
- `data/placementdata.csv` — synthetic dataset.
- `requirements.txt` — pandas, numpy, scikit-learn 1.8.0, streamlit 1.61.0, plotly, joblib.

## Why it was preserved

- Clean layered architecture and config-driven design that inspired the new platform.
- Transparent, well-documented ML workflow (training / evaluation / comparison) worth keeping as a reference.
- Synthetic data carefully generated; useful as a legacy demo.

## Run it

```bash
cd packages/legacy-ml
python -m venv venv
venv/Scripts/pip install -r requirements.txt
venv/Scripts/python -m streamlit run app.py
```

## Status

Legacy. New features are built in `packages/api`, `packages/frontend` and `packages/data-service`. This package is intentionally frozen.