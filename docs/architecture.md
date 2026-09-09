# Architecture

## System overview

```
┌──────────────────────────────┐      ┌─────────────────────────────────────┐
│  packages/frontend           │      │  packages/api                       │
│  React 18 · Vite · Tailwind  │ ───▶ │  Node.js · Express · Mongoose       │
│  shadcn-style UI             │      │  auth · profiles · evidence · roles │
│                              │      │  assessments · roadmap              │
└──────────────┬───────────────┘      └──────────────┬──────────────────────┘
               │  HTTP/JSON                          │
               │                                     │
               │                                     │   MongoDB
               │                                     ▼
               │                      ┌──────────────────────────────┐
               │                      │ MongoDB                      │
               │                      │ roles, skills, evidence,     │
               │                      │ assessments, marketSnapshots │
               │                      └──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  packages/data-service (py)  │      ┌──────────────────────────────┐
│  FastAPI                     │ ───▶ │ packages/legacy-ml           │
│  resume · GitHub · market    │      │ original Streamlit placement │
│  ML/NLP · embeddings         │      │ predictor (preserved)        │
└──────────────────────────────┘      └──────────────────────────────┘
```

## Module boundaries

- **Frontend** — presentation only. No business logic, no scoring, no API wiring embedded in components. Uses an API service layer (`src/lib/api.js`) with a centralized auth context.
- **Application API** — auth, authorization, CRUD, evidence, roles, assessments, roadmap. Uses middleware for validation (Zod), auth (JWT), rate limiting, CORS and centralized error handling. Service layer holds business logic; models hold schema.
- **Data/AI service** — heavy processing: resume parsing, GitHub analysis, market ingestion/analysis, ML/NLP, embeddings. Kept separate from CRUD so it can scale independently and be written in Python.
- **Shared contracts** — `@career/shared` holds Zod schemas used by both frontend and API so request/response shapes cannot drift.
- **Database** — MongoDB. Seed data for role/skill ontology and assessments lives in `packages/database/seeds` and is applied by `scripts/seed.js`.

## Technology choices

- **React + Vite + Tailwind + shadcn-style components** for a fast, modern, minimal SaaS UI.
- **Express + mongoose** for the app backend; TypeScript intentionally replaced by plain JavaScript + Zod for runtime validation.
- **FastAPI (Python)** for the data/AI backend.
- **MongoDB** because the domain is full of evolving, semi-structured entities (evidence, assessments, market snapshots, AI conversations). Vector search (Atlas) is available for the future RAG-based coach.
- **pino** for structured logging in the API; Python `logging` in the data service.

## Cross-cutting concerns

- **Security** — helmet, CORS allow-list, rate limiting, bcrypt password hashing, JWT with secrets from env, Zod input validation, no secrets in source. Uploads validate MIME type, size, and never trust filenames.
- **Error handling** — centralized error middleware maps all failures to a consistent JSON shape. Structured log lines for every request and every 5xx.
- **Config** — environment-driven (`.env.example` describes every variable). No magic constants scattered in modules.
- **Background jobs** — market ingestion and heavy processing run outside the request path. Initially a simple worker; no Kafka/microservices unless a real problem demands it.

## Evolution path

Modules are designed to be swapped/extended independently: a cloud object store for uploads, a managed code-execution sandbox for coding assessments, a real background queue for market ingestion. The current code keeps thin, replaceable seams for each.

See `docs/migration.md` for how the original project was relocated.