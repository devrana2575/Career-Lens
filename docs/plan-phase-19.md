# Phase 19 — Compare Roles

## Goal
Let students pick 2–4 target roles and see a side-by-side comparison of their
readiness, market demand, and per-skill requirements, so the choice of "which
role should I aim for" is data-driven instead of a guess.

## What shipped

### API (`packages/api`)
- `services/readiness.service.js` — exported `computeRoleSnapshot(userId, ref)`
  which resolves a role by id or slug and returns its readiness dimensions
  (technical, professional, evidence confidence), market alignment
  (via `computeMarketAlignment`), and `splitGaps` buckets. Returns `null` when
  the role doesn't exist or yields no analyzed skill items.
- `services/comparison.service.js` — `compareRoles(userId, refs)` builds one
  entry per role combining the readiness snapshot, `getRoleWithDetails`, the
  market benchmark (`getRoleBenchmark`), and skill rows
  `{ skillId, skillName, category, baselineLevel, weight, proficiency,
  hasScore, quality, marketShare }`. Market share is a plain percentage (0–100)
  derived from the candidate-share map. `validateCompareRoles` enforces 2–4
  refs and raises a 422 otherwise.
- `routes/comparison.routes.js` — `GET /api/comparison/roles?slugs=a,b,c`
  behind `requireAuth`, mounted at `/comparison`.
- `test/comparison.test.js` — 3 tests (auth, validation, two-role result shape).

### Frontend (`packages/frontend`)
- `pages/dashboard/ComparePage.jsx` — role picker grouped by family (max 4),
  results show per-role dimension bars, demand badge, top market skills,
  strengths/gaps, plus a "Skill requirements comparison" matrix (level, weight,
  proficiency, evidence quality, market share per role). Route
  `/dashboard/compare`, nav item "Compare roles".