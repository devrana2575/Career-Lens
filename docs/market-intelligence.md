# Market Intelligence (design, Phase 8)

## Principles

- **Legitimate sources only** — official APIs, licensed datasets, public job feeds, permitted company pages. No unauthorized scraping of platforms that prohibit it. A source abstraction allows adding sources later.
- **Never fabricate statistics.** If data is insufficient, surface "insufficient confidence / data volume" explicitly.
- **Historical snapshots, never overwritten.** Market data is append-only.

## Pipeline

```
JOB SOURCES → COLLECTION → RAW STORAGE → CLEANING → DEDUPLICATION → NLP EXTRACTION
→ SKILL NORMALIZATION → ROLE CLASSIFICATION → MARKET DATABASE → TREND ANALYSIS
→ ROLE BENCHMARKS
```

## Data model

| Collection | Purpose |
|---|---|
| `jobs` | Raw cleaned job entries (title, company, location, source, description); demo postings carry `isDemo: true` |
| `jobSkills` | Normalized skills extracted per job listing |
| `marketSnapshots` | Point-in-time aggregates keyed by `(snapshotDate, roleId, location, source)`: job count, top-10 skill frequencies, experience requirements, data volume + confidence |

## Status (Phase 8 — implemented)

- **Pipeline** (`packages/data-service/app/market/*`): cleans/deduplicates raw jobs, extracts skills by word-boundary matching against the ontology names + aliases, classifies roles by transparent keyword overlap (min. overlap 3, min. title matches 1, winner margin 1), writes append-only `marketSnapshots`. Re-runs are idempotent — an existing snapshot key is never overwritten. Triggered by operations `POST /api/market/build` (X-API-Key guarded, shared `security.py`) or the CLI `python -m app.market.pipeline`.
- **Demo dataset** (`packages/database/seeds/jobs.json`, 99 postings): labeled `isDemo: true` across 5 dated `collectedDate` batches so trends are computed honestly from labeled history — never invented.
- **Read API** (`GET /api/market/overview`, `/benchmarks`, `/skills/trends`): volumes, top skills, locations, experience ranges and trend labels with explicit `confidence: sufficient|insufficient` and `demand: rising|stable|declining|insufficient`.
- **Frontend**: `/dashboard/market` shows a DEMO DATA badge, role demand cards and skill trend table.

## Trend calculations

Skill frequency, skill growth, role relevance, recency, geographic demand, emerging technologies, data confidence, volume of observations — computed from historical snapshots, not invented.

Labels are derived from real counts:

- Role **demand**: `rising/declining` when the latest volume moves beyond ±20% of the previous snapshot, `stable` otherwise; `insufficient` with fewer than two dated snapshots.
- Skill **trends**: share = mentions ÷ jobs for the snapshots that report the skill on each date; `rising/declining` beyond a ±10-percentage-point share move, `insufficient` with a single date.
- **Confidence** is `sufficient` only when the observed volume is ≥ 5 postings, subject to honesty guarantees.
- `skillFrequencies` store top-10 skills per snapshot bucket.

## Benchmarks

Role requirements blend curated baseline definitions (`roleRequirements`) with market evidence as it accumulates. Requirements remain configurable and updateable; they are updated data, not hardcoded truth.