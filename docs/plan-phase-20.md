# Phase 20 — Recruiter Candidate Comparison

## Goal
Let recruiters select candidates and view their skill coverage side-by-side so
shortlisting decisions are grounded in comparable evidence.

## What shipped

### Bug fixes
- `services/recruiter.service.js` — the candidate-detail query used
  `Evidence.find({ candidateId })`, but the `Evidence` model keys on `userId`,
  so `recentEvidence` was always empty. Fixed to `{ userId: candidateId }`.
- `pages/dashboard/CandidatesPage.jsx` — `GET /roles` returns
  `{ families, roles }`; the page did `setRoles(rl)` and then `.map()`, which
  broke the role filter. Fixed to `rl.roles ?? []`.

### Comparison UI
- `CandidatesPage.jsx` — each candidate card now has a "Compare" checkbox; a
  summary line shows the selected count and links to the comparison view
  (disabled below 2).
- `pages/dashboard/CandidateComparePage.jsx` — new page at
  `/dashboard/candidates/compare?ids=...`. Calls the existing
  `POST /api/recruiter/candidates/compare` and renders per-candidate metric
  cards (readiness, technical, professional, target roles, recent evidence)
  plus a "Skill coverage matrix" table that buckets each skill as strength /
  critical gap / gap / no evidence per candidate.

## Notes
- The backend `compareCandidates` already existed (Phase 11–14 work); this phase
  was entirely about surfacing it in the UI and fixing the two data bugs that
  made the underlying data incomplete.