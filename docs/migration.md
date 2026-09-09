# Migration from Placement-Intelligence

This document records how the original repository was relocated and what decisions were made.

## Original repository (as audited)

A single-application Streamlit ML product: "Student Placement Prediction". RandomForest classifier over a synthetic 15,000-row CSV, with a polished dark-theme dashboard, model evaluation and dataset explorer pages.

**Strengths preserved conceptually:** clean separation of concerns, config-driven schema, custom exception hierarchy, defensible model-selection rationale, transparent rule-based "Career Readiness Score", SQL-free artifact management (joblib + JSON metadata).

## Decision: legacy analytics, not the product core

The placement-prediction model predicts a binary outcome on a 12-column synthetic dataset. It does not fit the product vision of an evidence-based, role-aware, market-aware readiness platform. It is therefore **preserved but de-emphasized** as a legacy analytics component rather than the main product.

## What happened to each part

| Original path | New location | Status |
|---|---|---|
| `app.py`, `src/`, `pages/`, `utils/`, `scripts/` | `packages/legacy-ml/` | Preserved, still runnable (`streamlit run app.py`) |
| `models/` (pipeline, feature names, metadata) | `packages/legacy-ml/models/` | Preserved for legacy analytics |
| `data/placementdata.csv` | `packages/legacy-ml/data/` | Preserved; synthetic, labeled in tooling |
| `notebooks/` | `packages/legacy-ml/notebooks/` | Preserved; noted in audit as stale vs production schema |
| `requirements.txt` | `packages/legacy-ml/requirements.txt` | Preserved (pandas, numpy, scikit-learn, streamlit, plotly, joblib) |
| `.streamlit/config.toml` | `packages/legacy-ml/.streamlit/` | Preserved for running legacy app |
| `image.png` (screenshot) | `packages/legacy-ml/` | Preserved as legacy asset |
| `.dist/` (empty) | deleted | Empty, meaningless |

## What was removed / never migrated into the new stack

- **Streamlit** as the application framework → replaced by React + Express + FastAPI.
- **CSV as primary storage** → replaced by MongoDB. The legacy CSV remains only inside `legacy-ml`.
- **Hardcoded placement readiness rule** → superseded by the future centralized evidence-weighted readiness engine.
- **`starlette==0.49.3` pin** → irrelevant to the new stack.

## What the new platform inherits in spirit

- Config-driven design (`.env` + `env.js` in the API, pydantic-settings in the data service).
- Centralized error handling and structured logging.
- Transparent, explainable scoring philosophy.
- Honest labeling of synthetic/demo data.

## Branding

The product name is configurable via `APP_NAME`. "Career Intelligence Platform" is the temporary internal name; no single historical name is hardcoded across the codebase.