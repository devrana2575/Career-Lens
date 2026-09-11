# Plan: Phases 11–14

> Remaining MVP completion and post-MVP features.

---

## Phase 11 — GitHub Analysis

**Goal:** Let students connect their GitHub username, analyze public repos, and record skill evidence — completing MVP item #8.

### Pattern
Follows the Phase 10 resume analysis pattern exactly:
- Data-service fetches + analyzes → returns matched skills with strength
- API service calls data-service → records evidence per skill
- Frontend page triggers analysis + shows results

### Shared (`packages/shared`)

**New file:** `src/domain/github.js`
- `GitHubAnalysisResultSchema` — `{ matchedSkills: [{ skillSlug, skillName, strength, repoCount, topRepos: [{ name, url, stars, description, languages[] }] }], stats: { publicRepos, totalStars, topLanguages[], activityLevel } }`
- `AnalyzeGitHubInputSchema` — `{ username: string }`

**Edit:** `src/index.js` — add re-exports from `domain/github.js`

### Data-Service (`packages/data-service`)

**New file:** `api/github.py`
- `POST /api/github/analyze` — accepts `{ username }`, calls GitHub public API, runs analyzer, returns `GitHubAnalysisResult`
- Protected by `require_api_key`

**New file:** `github/client.py`
- `fetch_github_profile(username)` — GET `https://api.github.com/users/{username}` → returns `{ publicRepos, followers, ... }`
- `fetch_user_repos(username, per_page=100)` — GET `https://api.github.com/users/{username}/repos?sort=updated&per_page=100` → returns repo list
- Handles rate limits (403) gracefully → returns error message
- No auth token needed for public data

**New file:** `github/analyzer.py`
- `analyze_github(profile, repos, skill_catalog, aliases)` — for each repo:
  - Extract languages → match to skills via catalog
  - Extract topics/description keywords → match via aliases
  - Count repos per skill → determine strength:
    - `high`: ≥3 repos with that language/skill
    - `medium`: 2 repos
    - `low`: 1 repo
  - Track stars per repo for top-repo selection
  - Compute `activityLevel`: high (≥20 repos), medium (5-19), low (<5)
- Returns matched skills sorted by strength desc

**Edit:** `main.py` — add github router

### API (`packages/api`)

**New file:** `services/github.client.js`
- HTTP client to data-service `/api/github/analyze`
- Same pattern as `resume.client.js`: POST with API key, 30s timeout, wraps errors as 502

**New file:** `services/github.service.js`
- `analyzeGitHub(userId, username)`:
  1. Calls `githubClient.analyze(username)`
  2. Loads skill catalog from DB
  3. For each matched skill: calls `evidenceService.addEvidenceSource()` with type `github`, strength from analyzer, description = repo list summary
  4. Fresh analysis replaces previous `github` sources for same skills (same pattern as resume)
  5. Returns analysis result + evidence updates

**New file:** `routes/github.routes.js`
- `POST /analyze` — `{ username: string }` — authenticated, calls `analyzeGitHub()`
- Mounted at `/api/github`

**Edit:** `routes/index.js` — add github router

### Frontend (`packages/frontend`)

**New file:** `pages/dashboard/GitHubPage.jsx`
- Input field pre-filled with profile `githubUsername`
- "Analyze" button → `POST /github/analyze`
- Results: matched skills with strength badges, repo stats (total repos, stars, top languages), activity level indicator
- Links to individual repos

**Edit:** `App.jsx` — add `/dashboard/github` route

**Edit:** `components/layout.jsx` — add "GitHub" nav link (between Resume and Market)

**Edit:** `pages/dashboard/ProfilePage.jsx` — ensure githubUsername field saves to profile

---

## Phase 12 — Projects Module

**Goal:** Let students add projects with tech stack, links, and descriptions → recorded as evidence.

### Shared (`packages/shared`)

**New file:** `src/domain/project.js`
- `ProjectSchema` — `{ id, userId, title, description, url?, repoUrl?, techStack: string[], skillsUsed: [{ skillSlug, role? }], startDate?, endDate?, isOngoing?, createdAt, updatedAt }`
- `CreateProjectInputSchema` — `{ title, description, url?, repoUrl?, techStack[], skillsUsed[], startDate?, endDate?, isOngoing? }`
- `UpdateProjectInputSchema` — partial of create

**Edit:** `src/index.js` — add re-exports

### API (`packages/api`)

**New file:** `models/project.model.js`
- Mongoose model for `projects` collection
- Fields: `userId` (ref User), `title`, `description`, `url`, `repoUrl`, `techStack[]`, `skillsUsed[{ skillSlug, skillId, role? }]`, `startDate`, `endDate`, `isOngoing`, timestamps

**New file:** `services/project.service.js`
- `createProject(userId, input)` — creates project, records evidence (type `project`, strength based on completeness: high if has URL + description + ≥3 skills, medium if 1-2 skills, low otherwise)
- `updateProject(userId, projectId, input)` — updates project, recalculates evidence
- `deleteProject(userId, projectId)` — deletes project, removes associated evidence
- `listProjects(userId)` — returns all projects sorted by startDate desc

**New file:** `routes/project.routes.js`
- `GET /` — list my projects
- `POST /` — create project
- `PUT /:id` — update project
- `DELETE /:id` — delete project
- All authenticated

**Edit:** `routes/index.js` — add project router at `/api/projects`

### Frontend (`packages/frontend`)

**New file:** `pages/dashboard/ProjectsPage.jsx`
- Project list with cards showing title, tech stack tags, description, links
- "Add Project" form/modal: title, description, URL, repo URL, tech stack (tag input), skill picker, dates
- Edit/delete actions per project
- Evidence recorded automatically on save

**Edit:** `App.jsx` — add `/dashboard/projects` route

**Edit:** `components/layout.jsx` — add "Projects" nav link (between Evidence and Assessments)

---

## Phase 13 — Recruiter Features

**Goal:** Let recruiters browse candidates, inspect evidence, compare, and shortlist.

### Shared (`packages/shared`)

**New file:** `src/domain/recruiter.js`
- `CandidateSummarySchema` — `{ userId, displayName, headline, targetRoles[], readinessScore?, evidenceCount, topSkills[] }`
- `ShortlistSchema` — `{ id, recruiterId, name, candidateIds[], createdAt, updatedAt }`
- `CandidateComparisonSchema` — `{ candidates: [{ userId, displayName, readiness: RoleReadinessSchema, evidence: SkillAssessmentSchema[] }] }`

**Edit:** `src/index.js` — add reexports

### API (`packages/api`)

**New file:** `models/shortlist.model.js`
- Mongoose model for `shortlists` collection

**New file:** `services/recruiter.service.js`
- `listCandidates(recruiterId, filters)` — paginated list of student profiles with readiness summary and evidence count. Filters: target role, min readiness, skills.
- `getCandidateDetail(recruiterId, candidateId)` — full candidate view: profile, evidence graph, readiness reports per target role, assessment attempts
- `compareCandidates(recruiterId, candidateIds[])` — side-by-side readiness + evidence comparison
- `createShortlist(recruiterId, name, candidateIds[])` — create named shortlist
- `listShortlists(recruiterId)` — list shortlists
- `updateShortlist(recruiterId, shortlistId, candidateIds[])` — update shortlist
- `deleteShortlist(recruiterId, shortlistId)` — delete shortlist

**New file:** `routes/recruiter.routes.js`
- `GET /candidates` — list candidates (recruiter only)
- `GET /candidates/:id` — candidate detail
- `POST /candidates/compare` — comparison
- `GET /shortlists` — list shortlists
- `POST /shortlists` — create shortlist
- `PUT /shortlists/:id` — update shortlist
- `DELETE /shortlists/:id` — delete shortlist
- All require `recruiter` or `admin` role

**Edit:** `routes/index.js` — add recruiter router at `/api/recruiter`

### Frontend (`packages/frontend`)

**New file:** `pages/dashboard/CandidatesPage.jsx`
- Candidate list with cards: name, headline, target roles, readiness badge, evidence count
- Filter bar: role selector, min readiness slider, skill search
- Click → candidate detail view

**New file:** `pages/dashboard/CandidateDetailPage.jsx`
- Full candidate profile: personal info, target roles
- Evidence graph (read-only view of their evidence)
- Readiness reports per target role with dimensions
- Assessment results
- "Add to Shortlist" action

**New file:** `pages/dashboard/ShortlistsPage.jsx`
- Shortlist management: create, view, edit
- Candidate cards within shortlist
- Comparison view: select 2-3 candidates → side-by-side readiness + skills

**Edit:** `App.jsx` — add routes: `/dashboard/candidates`, `/dashboard/candidates/:id`, `/dashboard/shortlists`

**Edit:** `components/layout.jsx` — add "Candidates" and "Shortlists" nav links (visible only for `recruiter`/`admin` roles, below existing nav section)

---

## Phase 14 — AI Career Coach

**Goal:** RAG-based conversational coach that answers career questions using the student's readiness data, evidence, and market intelligence.

### Shared (`packages/shared`)

**New file:** `src/domain/coach.js**
- `ConversationSchema` — `{ id, userId, title?, createdAt, updatedAt }`
- `MessageSchema` — `{ id, conversationId, role (user|assistant|system), content, context?: { readinessSummary?, marketInsights?, evidenceHighlights? }, createdAt }`
- `SendMessageInputSchema` — `{ conversationId?, content: string }`
- `CoachResponseSchema` — `{ messageId, conversationId, content, context }`

**Edit:** `src/index.js` — add reexports

### API (`packages/api`)

**New file:** `models/conversation.model.js`
- Mongoose model for `conversations` collection

**New file:** `models/message.model.js`
- Mongoose model for `messages` collection

**New file:** `services/coach.service.js`
- `listConversations(userId)` — list user's conversations
- `getConversation(userId, conversationId)` — get conversation with messages
- `sendMessage(userId, { conversationId, content })`:
  1. Create/reuse conversation
  2. Save user message
  3. Build context:
     - Load user's readiness reports (summary of dimensions + top gaps)
     - Load recent evidence highlights (last 10 evidence items)
     - Load market insights for target role (top skills, demand trends)
  4. Build system prompt with context + conversation history
  5. Call LLM API (OpenAI-compatible endpoint, configurable)
  6. Save assistant message with context snapshot
  7. Return response
- `deleteConversation(userId, conversationId)` — delete conversation + messages

**New file:** `routes/coach.routes.js`
- `GET /conversations` — list conversations
- `GET /conversations/:id` — get conversation messages
- `POST /conversations` — create new conversation
- `POST /conversations/:id/messages` — send message (or create new conversation)
- `DELETE /conversations/:id` — delete conversation
- All authenticated

**Edit:** `routes/index.js` — add coach router at `/api/coach`

**Edit:** `config/env.js` — add LLM API config (URL, key, model)

### Frontend (`packages/frontend`)

**New file:** `pages/dashboard/CoachPage.jsx`
- Conversations list sidebar (new conversation button, list of past conversations)
- Chat area: message history with user/assistant bubbles
- Input field + send button
- Context indicators showing what data is being used (readiness, market, evidence)
- Auto-scroll to latest message

**Edit:** `App.jsx` — add `/dashboard/coach` route

**Edit:** `components/layout.jsx` — add "Coach" nav link (between Projects and Assessments)

---

## Execution Order

| Phase | Depends On | Estimated Scope |
|-------|-----------|-----------------|
| 11 — GitHub Analysis | Phase 10 (resume pattern) | 3 new files data-service, 3 new files API, 1 new page frontend, shared schema |
| 12 — Projects Module | None (standalone) | 1 model, 1 service, 1 route, 1 page, shared schema |
| 13 — Recruiter Features | Phases 11-12 (reads evidence/projects) | 1 model, 1 service, 1 route, 3 pages, shared schema |
| 14 — AI Career Coach | Phases 11-13 (reads all data) | 2 models, 1 service, 1 route, 1 page, shared schema, env config |
