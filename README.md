# Career Intelligence Platform

An evidence-based career intelligence platform that helps students understand, demonstrate, and continuously improve their readiness for real technology roles — and helps recruiters evaluate candidates on evidence rather than self-reported claims.

> **Status: early-stage / in active development.**
> This is the ongoing rebuild of the original **Placement-Intelligence** Streamlit project into a production-grade platform. The legacy ML application is preserved under `packages/legacy-ml`.

---

## The problem

Most placement/readiness tools treat "job ready" as a binary flag, rely on self-reported skill scores ("Python = 90%"), and give no reason why a student is or is not ready.

## The solution

This platform is built on a simple principle:

> **Every score has evidence. Every recommendation has a reason. Every market claim has data.**

The core loop:

```
LEARN → PRACTICE → BUILD → PROVE → MEASURE → IDENTIFY GAPS → IMPROVE → REASSESS → REPEAT
```

Students select a **target role**, build up **validated evidence** (assessments, projects, resume, GitHub, external practice), and receive a continuous **Career Readiness Estimate** — separated into proficiency and **evidence confidence**. The system is **role-aware** (roles and skills are configured as data, never hardcoded) and **market-aware** (role benchmarks derive from legitimate job-market signals).

## Core features

- **Evidence-based skill evaluation** — proficiency is traced to specific evidence sources; self-claims carry far less weight.
- **Evidence graph** — every score is explainable ("why does this score exist?").
- **Technical assessment engine** — MCQ, coding, SQL, debugging and practical-case assessments stored as data.
- **Resume, GitHub and project intelligence** — treated as evidence sources, never ground truth.
- **Readiness engine** — centralized, explainable, configurable scoring with meaningful rounding.
- **Skill-gap engine & personalized roadmap** — action-oriented next steps (not generic "learn DSA").
- **Market intelligence** (in progress) — legitimate job-market signals → role benchmarks; nothing fabricated.
- **AI career coach** (planned) — grounded in the student's own evidence and market data.

## Architecture

Monorepo powered by npm workspaces:

| Package | Stack | Responsibility |
|---|---|---|
| `packages/frontend` | React 18, Vite, Tailwind CSS, shadcn-style UI | Student & recruiter web app |
| `packages/api` | Node.js, Express | Auth, profiles, evidence, roles, assessments, roadmap (app CRUD + business logic) |
| `packages/data-service` | Python, FastAPI | Resume parsing, GitHub analysis, market intelligence, ML/NLP, advanced analytics |
| `packages/shared` | JS + Zod schemas | Shared contracts between frontend and API |
| `packages/database` | MongoDB seed data | Role/skill ontology, assessment sets (skills, roles, competencies, aliases) |
| `packages/legacy-ml` | Python, scikit-learn, Streamlit | Original placement-prediction app (legacy analytics, preserved) |

Database: **MongoDB** (Atlas-ready). Frontend/API share an API foundation that supports a future data-service integration.

See [`docs/architecture.md`](docs/architecture.md) for details.

## Getting started

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.11
- A running MongoDB instance (local `mongod` or MongoDB Atlas)

### Setup

```bash
# 1. Install JS workspace dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env with your MONGODB_URI and JWT_SECRET

# 3. Seed the role/skill ontology
node packages/database/scripts/seed.js

# 4. Set up the Python data service (optional for basic use)
cd packages/data-service
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"   # on Unix: .venv/bin/pip install -e ".[dev]"

# back to repo root
cd ../..
```

### Run

```bash
npm run dev:api        # Node/Express API on :4000
npm run dev:frontend   # React app on :5173 (proxies /api -> :4000)
```

Data service (optional for now):

```bash
cd packages/data-service
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

Open http://localhost:5173, create an account, and complete your profile.

### Tests

```bash
npm test               # runs vitest across JS packages
cd packages/data-service && .venv/Scripts/python -m pytest
```

## Environment variables

See [`.env.example`](.env.example). Required for production: `MONGODB_URI`, `JWT_SECRET`, `DATA_SERVICE_API_KEY`. Never commit a real `.env`.

## Documentation

- [`docs/product.md`](docs/product.md) — product vision and principles
- [`docs/architecture.md`](docs/architecture.md) — system architecture and module boundaries
- [`docs/data-model.md`](docs/data-model.md) — database model (in progress)
- [`docs/evidence-model.md`](docs/evidence-model.md) — evidence & confidence model (in progress)
- [`docs/readiness-engine.md`](docs/readiness-engine.md) — scoring engine (in progress)
- [`docs/security.md`](docs/security.md) — security posture (in progress)
- [`docs/migration.md`](docs/migration.md) — decisions made migrating from Placement-Intelligence

## Roadmap

- **Phase 0 — Foundation** ✅ monorepo, workspaces, config, shared contracts
- **Phase 1 — Full stack + auth** ✅ frontend, API, data-service, MongoDB, JWT, profiles
- **Phase 2 — Roles & skill ontology** 🚧 seed data + onboarding + dashboard
- **Phase 3 — Evidence system** ⬜ projects, practice records, confidence model
- **Phase 4 — Assessment engine** ⬜ MCQ, SQL, coding (sandboxed), practical cases
- **Phase 5 — Resume/GitHub/project intelligence** ⬜ Python service
- **Phase 6 — Readiness + gaps + roadmap** ⬜ evidence-weighted scoring, next-best-action
- **Phase 8 — Market intelligence** ⬜ legitimate sources, snapshots, trends
- **Phase 9 — AI career coach** ⬜ RAG-grounded coaching
- **Phase 10 — Recruiter platform** ⬜ evidence-based candidate evaluation

This roadmap is a sequence, not a promise — each phase ships only when genuinely functional.

## License

MIT. See [`LICENSE`](LICENSE).