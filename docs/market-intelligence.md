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
| `jobs` | Raw cleaned job entries (title, company, location, source, description) |
| `jobSkills` | Normalized skills extracted per job listing |
| `marketSnapshots` | Point-in-time aggregates: timestamp, role, location, source, job count, skill frequencies, experience requirements, data confidence, volume |

## Trend calculations

Skill frequency, skill growth, role relevance, recency, geographic demand, emerging technologies, data confidence, volume of observations — computed from historical snapshots, not invented.

## Benchmarks

Role requirements blend curated baseline definitions (`roleRequirements`) with market evidence as it accumulates. Requirements remain configurable and updateable; they are updated data, not hardcoded truth.