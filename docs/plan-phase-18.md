# Phase 18 — Personalized Roadmap

## Goal
Give students an actionable, per-role learning roadmap built from their
readiness gaps, so they know *what* to work on *next* instead of staring at a
readiness score.

## What shipped

### API (`packages/api`)
- `models/roadmap.model.js` — `Roadmap` model keyed by `{ userId, roleId }`
  (unique compound index). Stores `roleSlug`, `roleName`, `generatedAt`, and
  `tasks[]` where each task = `{ id: "task-" + skillId, skillId, skillName,
  action, reason, impact, effortEstimate, status, completedAt }`. `toJSON`
  computes `progress` = completed / total tasks.
- `services/roadmap.service.js`:
  - `generateRoadmaps(userId)` — recomputes a roadmap per target role from the
    readiness engine (`splitGaps` + `buildRoadmap` + `computeMarketAlignment`).
    Completion state is preserved across regenerations by matching `skillId`
    (done tasks stay done only while the skill is still a gap; once the skill is
    proven, its task is dropped).
  - `listRoadmaps(userId)`, `toggleTask(user, roadmapId, taskId)`,
    `deleteRoadmap(userId, roadmapId)`.
- `routes/roadmap.routes.js` — `GET /api/roadmap`, `POST /api/roadmap/generate`,
  `PATCH /api/roadmap/:id/tasks/:taskId`, `DELETE /api/roadmap/:id`, all behind
  `requireAuth`. Mounted at `/roadmap` in `routes/index.js`.
- `readiness.service.js` — exported `splitGaps`, `buildRoadmap`,
  `computeMarketAlignment` for reuse; added `computeRoleSnapshot(userId, ref)`
  for the comparison feature (Phase 19).
- `test/roadmap.test.js` — 7 tests: auth guard, empty list, generation,
  toggle + 404s, completion preserved across regeneration, task removal once a
  skill is proven, delete.

### Frontend (`packages/frontend`)
- `pages/dashboard/RoadmapPage.jsx` — lists each target role's roadmap with a
  progress bar, impact/effort badges, actionable tasks with checkboxes that
  toggle status, and Generate/Regenerate control. Route `/dashboard/roadmap`,
  added to the student nav.

## Notes
- A roadmap only makes sense once the user has evidence-driven readiness data;
  the page shows the readiness score and gap summary it was derived from.