# Assessment Engine (design, Phase 4)

## Goals

- Question sets and scoring rules are **data**, not code — new assessments require no code changes.
- Real, meaningful evaluation: SQL solved against controlled schemas, coding evaluated via a sandboxed executor, practical cases graded against rubrics.
- Every attempt becomes **evidence** with a score and timestamp, feeding the evidence graph.

## Data model

| Collection | Purpose |
|---|---|
| `assessments` | Set definition: role, competency, skill, type, scoring config, time limit |
| `assessmentQuestions` | Questions: type (MCQ / coding / SQL / debugging / practical / written), difficulty, expected answer / test cases, explanation, tags |
| `assessmentAttempts` | Per-student attempts: answers, per-question results, total score, started/completed times |
| `codingSubmissions` | Code + language, stdout, runtime/memory stats, deterministic-run details, sandbox reference |

## Assessment types

MCQ · coding · SQL · debugging · practical task · case study · scenario-based · written response · project evaluation.

## Security constraints

- Arbitrary student code is **never** executed on the main server. A replaceable sandboxed-execution seam (isolated worker / managed execution service) is used instead.
- SQL evaluation runs against a controlled, read-only schema per problem.
- Attempts are immutable evidence — never overwritten.

## Roadmap

1. ✅ Shared assessment schemas (`@career/shared`) + Mongoose models.
2. ✅ Seed data: initial MCQ/SQL/DSA sets per role.
3. ✅ API: list → start → submit → score → evidence record.
4. ✅ Frontend assessment runner (MCQ, SQL textarea, Python coding).
5. ✅ SQL engine in the data service (`POST /api/execute/sql`, in-memory SQLite, SELECT-only, timeouts, rowset comparison).
6. ✅ Sandboxed coding execution (`POST /api/execute/code`, `python -I` subprocess seam, per-case stdin/stdout tests, timeouts + output caps).
7. ✅ Rubric-scored practical / case-study assessments: published per-question rubrics, submissions move to `pending_review`, then admin/mentor review (`GET /attempts/pending`, `POST /attempts/:id/review`) scores each criterion and writes high-strength evidence. Auto-graded types stay immutable on submit.