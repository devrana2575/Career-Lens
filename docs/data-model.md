# Data Model

> Reflects the current implementation. Evolves as phases land.

## Conventions

- MongoDB document store. Collections are deliberately granular (evidence, projects, market snapshots are separate from profiles).
- Mongoose models enforce schema at the application API layer.
- Shared Zod schemas in `@career/shared` define API contracts (see `packages/shared/src`).

## Collections

### users
`email` (unique), `passwordHash`, `displayName`, `role` (`student | recruiter | admin`), `avatarUrl`, `isActive`, timestamps.

### profiles
One per user. `profileType` (`student | recruiter`) plus nullable domain fields:
- Student: `headline`, `bio`, `location`, `education[]`, `yearsOfExperience`, `githubUsername`, `portfolioUrl`, `linkedinUrl`, `selfReportedSkills[]` (`skillId`, `claimedLevel`), `targetRoleIds[]`.
- Recruiter: `company`, `title`.

> Self-reported skills are stored separately from evidence so readiness weighting can treat them differently.

### skills
Canonical normalized skill catalog: `name`, `slug`, `category`, `parentId` (for subskills), `children`.

### skillAliases
Normalization map: `alias` → `skillId` (e.g. "React.js", "ReactJS" → React).

### competencies
Role-scoped groups: `name`, `slug`, `skillIds[]`, `roleId`.

### roles
`name`, `slug`, `family`, `competencyIds[]`, `isActive`. Roles and requirements are **data**, not code.

### roleRequirements
Per role × skill baseline: `baselineLevel` (`optional|preferred|required|critical`), `weight`, `minYearsExperience`, `source` (`curated|market|admin`).

### evidence (planned, Phase 3)
`userId`, `skillId`, `competencyId`, `sources[]` (type, referenceId, url, score, occurredAt), `proficiencyScore`, `confidenceScore`.

### Further planned collections
`projects`, `resumes`, `githubProfiles`, `assessments`, `assessmentQuestions`, `assessmentAttempts`, `codingSubmissions`, `practiceRecords`, `jobs`, `jobSkills`, `marketSnapshots`, `roadmaps`, `roadmapTasks`, `conversations`, `messages`, `recruiterRoles`.

## Seeding

The role/skill ontology is applied idempotently by:

```bash
node packages/database/scripts/seed.js
```

Source data lives in `packages/database/seeds/**/*.json`. `roleRequirements` are derived from the curated ontology when no explicit file is present.