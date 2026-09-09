# Resume Engine

> Design for Phase 10. Resume parsing produces **supporting evidence**, never fabricated proficiency.

## What it does

Students paste their resume (or upload a `.txt` / `.md` file) and the system:

1. **data-service** `POST /api/resume/analyze` — parses the text against the ontology using the same word-boundary vocabulary as the market extractor, then reports the matched skills with a **prominence strength** and the number of mentions.
2. **API** `POST /api/resume/analyze` (Bearer auth) — proxies to the data service, filters matches to active ontology skills, and records a `resume` evidence source per matched skill on the student's evidence graph.

## Honesty rules

- **Strength = prominence, not skill.** `high` means the skill is listed as a bullet under a skills-style section; `medium` means 3+ body mentions; `low` means a single passing mention. This is *how saliently the skill is presented*, never a validated proficiency number.
- **No proficiency from resumes.** The evidence graph's `proficiencyScore` is only derived from scored, assessed sources. A resume source carries no `score`, so it raises **evidence confidence** but never invents a proficiency.
- **Latest resume wins.** Re-uploading replaces the previous `resume` source for each matched skill — there is always exactly one resume source per skill.
- **No unexplained skills.** Matches that aren't in the ontology are skipped (`skipped` in the response) instead of being invented.
- **Identity shared.** Both apps use the same `career_intelligence` MongoDB database, so skill IDs from the parser map 1:1 onto the API's skill model.

## Strength heuristic

| Condition | Strength |
|---|---|
| Skill appears as a bullet under a header like `Skills` / `Technical Skills` / `Tools` | `high` |
| 3+ word-boundary mentions in the body | `medium` |
| 1–2 passing mentions | `low` |

The match vocabulary is built from `skills` + `skillAliases` collections and matches word boundaries (`(?<![a-z0-9])…(?![a-z0-9])`), so `HTML` never claims `ML` and `Pandas` is not confused with `Panda`.

## API

- **data-service:** `POST /api/resume/analyze` — body `{ text, fileName? }`, requires `X-API-Key`. Returns `{ fileName, matchedSkills: [{ skillId, name, category, mentions, strength }], note }`.
- **API:** `POST /api/resume/analyze` — body `{ text, fileName? }`, requires Bearer auth. Returns `{ fileName, matched, added, skipped, hits, note }`.

## Frontend

`/dashboard/resume` — paste or upload a resume, review the matched skills with strength badges, and jump to the evidence graph. Frontend accepts `.txt` / `.md` only (read client-side).