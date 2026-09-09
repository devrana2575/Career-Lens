# API

Base URL (dev): `http://localhost:4000/api`

All endpoints return consistent JSON. Errors:

```json
{ "error": { "code": "REQUEST_ERROR", "message": "...", "details": [...] } }
```

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, displayName, role? }` | Creates user + profile, returns `{ user, tokens }` |
| POST | `/auth/login` | `{ email, password }` | Returns `{ user, tokens }` |
| GET | `/auth/me` | — | Requires Bearer token; returns current user |

## Profiles

| Method | Path | Notes |
|---|---|---|
| GET | `/profiles/me` | Requires auth |
| PATCH | `/profiles/me` | Requires auth; Zod-validated partial update |
| GET | `/profiles/public/:id` | Public profile by id |

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness + DB state |

## Conventions

- Authentication: `Authorization: Bearer <token>`.
- Validation: Zod schemas shared from `@career/shared`; invalid payloads → `422` with field-level `details`.
- Rate limiting: configured by `RATE_LIMIT_*` env vars.
- Structured logs: every request emits a `pino` JSON log line.

The data service (`packages/data-service`) exposes `/api/health` at `:8000` and will host Python-only endpoints (resume, GitHub, market).

Full endpoint reference grows with each phase.