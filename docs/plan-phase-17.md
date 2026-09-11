# Plan: Phase 17 — Assessment Authoring (Question Bank Management)

> Post-MVP: let admins and mentors author assessments and questions in the UI instead of only through DB seeds.

---

## Shared (`packages/shared`)

**Edit:** `src/domain/assessment.js` — add authoring payload schemas
- `AssessmentTypeSchema` shared by create/update paths
- `QuestionOptionSchema` — `{ id, text }`
- `RubricCriterionSchema` — `{ id, label, description?, maxPoints }`
- `CreateAssessmentInputSchema` — optional `id` (defaults to `assess-<uuid>` server-side), `title`, `description?`, `type`, `skillId`, `roleId?`, `timeLimitMinutes?` (10), `isActive?` (true)
- `UpdateAssessmentInputSchema` — same fields, all optional, **no defaults** so omitted keys are untouched
- `QuestionInputSchema` — `type`, `prompt`, `options?` ([]), `correctOptionId?`, `explanation?`, `difficulty?` (intermediate), `points?` (1), `orderIndex?`, `config?` ({}), `rubric?` ([])
- `CreateQuestionInputSchema` (`= QuestionInputSchema`) / `UpdateQuestionInputSchema` — all optional, **no defaults**
- `CreateAssessmentResponseSchema` / `AssessmentListResponseSchema` / `QuestionAnsweringPayloadSchema` already present are untouched

## API (`packages/api`)

**New file:** `services/assessmentAdmin.service.js`
- `listAssessmentBank()` — assessments sorted by title enriched with `skillName`, `roleName`, `questionCount`
- `getAssessmentDefinition(id)` — assessment + ordered questions
- `createAssessment(input)` — 201; skips duplicate custom ids (`AppError 409`)
- `updateAssessment(id, input)` — partial field updates; if grading type changes, verifies every existing question still conforms
- `archiveAssessment(id)` — sets `isActive:false`, 204
- `createQuestion(assessmentId, input)` — forces question `skillId` from the assessment; auto `orderIndex` = max+1; 201
- `updateQuestion(id, input)` — merges only explicitly provided fields; re-validates the whole question; 200
- `deleteQuestion(id)` — 204; 409 when any attempt references the question
- `validateTypeShape(type, question)` — authoring rules that mirror the grading engine:
  - `mcq` — ≥ 2 options and `correctOptionId` must reference one
  - `sql` — `config.schema.tables` non-empty
  - `coding` — `config.cases` non-empty
  - `practical`/`case_study` — rubric (≥ 1 criterion) required
- `assertQuestionTypeMatches(assessmentType, questionType)` — auto-graded assessments accept only auto types; rubric assessments accept rubric + other right now (ungraded on purpose); prevents saving an un-runnable mix

**New file:** `routes/assessmentAdmin.routes.js` — all rows behind `requireAuth` + `requireRole('admin', 'mentor')`
- `GET /assessment-bank`
- `GET /assessment-bank/:id`
- `POST /assessment-bank` (201)
- `PUT /assessment-bank/:id`
- `DELETE /assessment-bank/:id` (204)
- `POST /assessment-bank/:assessmentId/questions` (201)
- `PUT /assessment-bank/questions/:questionId`
- `DELETE /assessment-bank/questions/:questionId` (204 / 409)

**Edit:** `routes/index.js` — import and mount at `/api/assessment-bank`

**New test:** `test/assessment-admin.test.js`
- Access control: 401 unauthenticated, 403 student, 200 admin + mentor
- Assessment CRUD: create/list/read enrichment, duplicate id → 409, update including activation, archive → 204 and listed as inactive, missing → 404
- Question authoring: MCQ create + list, rejects missing/typo correct option (422), single option (422), coding with and without cases, SQL with and without schema, case_study with and without rubric, incompatible type in an MCQ assessment (422), update merging only provided fields, re-validation on update, delete blocked by attempts (409) then allowed (204)
- Cleanup by `_id`/`assessmentId` regex `^assess-bank-`

## Frontend (`packages/frontend`)

**New file:** `pages/dashboard/AssessmentBankPage.jsx` (admin/mentor only)
- List view — cards with type label, skill, role, question count, time limit, active/archived pill; "New assessment"
- Editor view:
  - Assessment fields: title, description, grading type, skill (`/skills`), target role (`/roles`), time limit, active toggle
  - Changing grading type drops questions that no longer conform
  - Question cards: type select (restricted to types compatible with the assessment), difficulty, points, prompt, explanation
  - Type-specific inputs: MCQ options with radio-selected correct answer; SQL/coding JSON config textareas (schema+expected / language+cases, pre-filled templates); practical/case_study rubric criterion rows (label, description, max points)
  - Add/remove questions; removing a persisted question queues a `DELETE`
- Save flow: upsert the assessment, then create/update each question with its `orderIndex`, then delete removed ids
- Client validation mirrors the server (title, skill, ≥ 1 question, prompt, ≥ 2 MCQ options + correct one, valid JSON config, ≥ 1 rubric label)

**Edits:**
- `App.jsx` — add `/dashboard/assessment-bank` route
- `components/layout.jsx` — add "Assessment bank" to reviewer nav

---

### Verification
- `npm run lint` clean (all workspaces)
- `npm test` — 107 API tests pass (89 existing + 18 assessment-admin)
- `vite build` succeeds