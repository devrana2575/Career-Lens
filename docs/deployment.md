# Deployment runbook

The platform is four moving parts:

| Part | Where | How it runs |
| --- | --- | --- |
| API (Express + Mongoose) | `packages/api` | `npm run dev` / `npm run start` |
| Frontend (Vite + React) | `packages/frontend` | `npm run dev` / `npm run build` then serve `dist` |
| Execution sandbox (Python) | `packages/data-service` | `uvicorn app.main:app` on `DATA_SERVICE_URL` |
| Optional ML reranker | `packages/legacy-ml` | separate model service (see below) |

## Local dev

```bash
# 1. install workspace deps
npm install

# 2a. MongoDB
#    (or: docker run -d -p 27017:27017 mongo)

# 2b. execution sandbox
cd packages/data-service && pip install -r requirements.txt && uvicorn app.main:app --port 8000

# 3. API
cp .env.example .env   # fill in secrets
npm run dev -w @career/api   # http://localhost:4000

# 4. Frontend
npm run dev -w @career/frontend   # http://localhost:5173
```

Environment variables are documented in `.env.example`. The API **will run without
`LLM_API_URL`, SMTP, or the sandbox**, degrading gracefully:
- Coach replies with a "not configured" message when no LLM is set.
- Email (password reset / verification / notifications) logs to the server console
  when no SMTP is configured — links are still discoverable there for dev/testing.
- Assessment `sql` / `coding` questions and sandbox endpoints return 502 if the
  `data-service` isn't reachable.

## Checks before you ship

1. `npm run lint` at the workspace root passes.
2. `npm test -w @career/api` passes (API integration suite, runs on an in-memory Mongo).
3. `npm test -w @career/frontend` passes (component tests via Vitest + RTL).
4. `npm run build -w @career/frontend` succeeds.

## Production notes

- **Secrets**: generate `JWT_SECRET` (e.g. `openssl rand -hex 32`) and a strong
  `DATA_SERVICE_API_KEY`. Never commit `.env`.
- **Execution sandbox isolation**: the `data-service` must run on its own host/VPC
  and be fronted only by the API. For untrusted student code, run it in a
  VM-sandboxed runner (gVisor / Firecracker), block network egress, enforce
  per-tenant quotas, and watch resource limits. `app.api.security.require_api_key`
  refuses requests without the key.
- **Email**: set `SMTP_*` (or point `MAILHOOK_URL` at a transactional provider
  webhook). Password reset and verification links point at `FRONTEND_URL`.
- **LLM API key**: keep server-side only; never ship it to the browser.
- **MongoDB backups** and rate-limit tuning (`RATE_LIMIT_*`) depend on expected load.

## The ML reranker seam

`packages/api/src/services/ml.service.js` exposes `rankSkillProficiency(...)` which
calls `${ML_API_URL}/v1/predict` when configured and returns `null` otherwise. The
evidence graph currently uses the bundled rules so nothing depends on ML for
correctness; the legacy-ml work can be wired into scoring without behavior changes
while unavailable. Integration work there (model serving, feature pipeline, A/B)
is a deliberate follow-up.