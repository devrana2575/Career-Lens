# Phase 22 — Managed Sandbox Service

## Goal
Offer students a safe, isolated place to run ad-hoc SQL / code against
realistic plumbing, without ever touching the platform database.

## Status: already implemented (verified, no new code required)

### Backend (`packages/data-service`)
- `app/api/execute.py` exposes:
  - `POST /api/execute/sql` — runs a read-only database snapshot query.
  - `POST /api/execute/code` — executes user code with execution and memory
    limits.
- Both endpoints require the `X-API-Key` header (`app.api.security.
  require_api_key`), validate input through Pydantic models (size/time limits),
  enforce timeouts, and never share the platform's MongoDB connection.

### API integration (`packages/api`)
- `services/execution.client.js` posts to `env.dataServiceUrl` with the API
  key; the sandbox service seam (`/sandbox/*`) forwards requests and remaps
  errors into the platform's error format.

## Notes
- Production-grade isolation (gVisor / Firecracker VMs, network egress
  blocking, per-tenant quotas) is deployment configuration, not application
  code. This phase is complete at the code level; anything further belongs in
  the ops layer.