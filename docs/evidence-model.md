# Evidence Model

> Design for the evidence system (Phase 3). Shared Zod schemas already define the shape in `packages/shared/src/domain/evidence.js`.

## Core distinction

**Proficiency** and **confidence in proficiency** are separate concepts and are reported separately.

Example:

```
Python
├── Assessment: 86%
├── Coding assessment: 82%
├── GitHub evidence: strong
└── Project evidence: strong
→ Proficiency: 82      Evidence Confidence: HIGH

Docker
└── self-reported only
→ Proficiency: unknown/low   Evidence Confidence: LOW
```

## Evidence types

`technical_assessment`, `coding_assessment`, `sql_assessment`, `practical_task`, `dsa_practice`, `github`, `project`, `deployed_application`, `resume`, `certification`, `internship`, `experience`, `portfolio`, `written_assessment`, `communication_assessment`, `interview_simulation`, `self_reported`.

Different competencies accept different evidence types:

| Competency | Acceptable evidence |
|---|---|
| Python | coding assessment, debugging, GitHub, project, assessment |
| SQL | SQL assessment, project, external SQL practice |
| DSA | coding assessment, external practice, topic/difficulty coverage, assessment |
| ML | ML assessment, practical project, GitHub, dataset analysis |
| Frontend | practical task, deployed project, GitHub |
| Communication | written task, scenario response, interview simulation |

## Evidence strength

Each evidence item carries relative strength (`low | medium | high`). Aggregated per skill as:

- `proficiencyScore` (0–100), derived only from accepted evidence sources.
- `confidenceScore` (0–100), reflecting volume, recency, strength and independence of sources.

Self-reported claims map to the `self_reported` type with low strength — supplementary, never primary.

## Evidence Graph

The evidence graph (per student) maps skills → sources → estimated proficiency → confidence, so the UI can always answer *why* a score exists. No unexplained scores.