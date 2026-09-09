# Development

## Repository layout

```
packages/
  frontend/       React + Vite + Tailwind (student/recruiter UI)
  api/            Express + Mongoose (app backend)
  data-service/   FastAPI (Python data/AI backend)
  shared/         Zod contracts, shared by frontend & api
  database/       seed data + seed scripts
  legacy-ml/      original Streamlit placement predictor (preserved)
docs/             product, architecture, data model, etc.
```

## Commands

Root (npm workspaces):

```bash
npm install                    # install all workspaces
npm run dev:api                # Express API on :4000
npm run dev:frontend           # Vite dev server on :5173
npm run build                  # build all workspaces with build scripts
npm run lint                   # eslint across workspaces
npm test                       # vitest across workspaces
```

Python data-service:

```bash
cd packages/data-service
.venv/Scripts/uvicorn app.main:app --reload --port 8000   # Windows
.venv/bin/uvicorn app.main:app --reload --port 8000        # Unix/macOS
.venv/Scripts/python -m pytest                             # tests
.venv/Scripts/ruff check .                                 # lint
```

Legacy app (standalone):

```bash
cd packages/legacy-ml
python -m venv venv
venv/Scripts/pip install -r requirements.txt
venv/Scripts/python -m streamlit run app.py
```

## Environment

Copy `.env.example` → `.env` at repo root. API overrides defaults via `dotenv`. Python service reads its own envs with `DATA_` prefix (see `app/config.py`).

## Conventions

- ESM everywhere in JS packages (`"type": "module"`).
- Shared contracts live in `@career/shared`; frontend and API import from it — never duplicate schemas.
- Business logic lives in API service modules and Python modules, not in UI components.
- Tests: vitest + supertest (API, with `mongodb-memory-server`), pytest + httpx (data-service). Readiness engine will be heavily tested in Phase 6.
- Run `npm run lint` and `npm test` before finishing a change.

## CI

GitHub Actions runs lint, tests and frontend build on push/PR (`.github/workflows/ci.yml`).