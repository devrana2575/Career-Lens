# Security

Foundations implemented or planned:

- **Secrets** — all config via environment variables (`.env.example` documents them). `.env` is gitignored. `JWT_SECRET` and `DATA_SERVICE_API_KEY` are never committed.
- **Authentication** — bcrypt hashing (cost 12) for passwords; stateless JWT (`HS256`) with expiry; verification middleware `requireAuth`.
- **Authorization** — role guard middleware (`requireRole`) for restricted endpoints; ownership checks on resources.
- **Transport/headers** — `helmet`, CORS allow-listed to `FRONTEND_URL`, `x-powered-by` disabled, trust proxy set behind a reverse proxy.
- **Rate limiting** — `express-rate-limit` from `RATE_LIMIT_*` env.
- **Input validation** — Zod schemas on every request body; centralized `validate` middleware; mongoose injects/binds queries.
- **Error handling** — centralized error middleware maps `ValidationError`, duplicate-key, and `CastError` to safe responses; never leaks internals.
- **File uploads (planned, Phase 3)** — MIME type + extension + size validation, generated storage names (never trust user filenames), storage abstraction for cloud object stores.
- **Code execution (planned, Phase 4)** — arbitrary student code is **never** executed inside the main server. A replaceable sandboxed-execution seam will route coding assessment runs to isolated workers or a managed execution service.

## Threat model summary

- Unauthenticated access → JWT + `requireAuth`.
- Privilege escalation → role guard + ownership checks; tokens embed `role`.
- Injection → Zod validation + mongoose/parameterized queries.
- Replay/abuse → JWT expiry + rate limiting.
- Malicious uploads → MIME/size validation + abstraction seam.
- RCE via student code → isolated execution seam only.