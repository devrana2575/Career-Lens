# Readiness Engine

> Design for Phase 6. Intentionally centralized and configurable; no scoring logic lives in frontend components.

## Dimensions

- **Technical Readiness** — role-specific competency coverage weighted by `roleRequirements`.
- **Professional Readiness** — communication, collaboration and delivery evidence.
- **Market Alignment** — how current skill levels compare with market-derived benchmarks.
- **Evidence Confidence** — aggregated confidence backing the above.

> **Phase 9 (shipped):** Market Alignment is now computed from the market engine's `marketSnapshots`. It is the evidence-weighted share of a role's required skills that also appear in the role's latest benchmark (sufficient volume ≥ 5 postings). Skills never seen in the market are excluded rather than guessed, and the number stays `null` (blank in the UI) with a stated reason when no benchmark exists or its volume is too sparse — no fabricated alignment. Roadmap reasons additionally note when a gap hits a market-demanded skill ("appears in X% of recent postings").

Overall estimate is derived from role-specific competency coverage. The exact formula is centralized in one module and configurable (weights from `roleRequirements`, refreshed from market data).

## Rules

- **Explainable** — every score carries reasons: strongest areas, weakest areas, missing competencies, supporting evidence, market requirements.
- **Evidence-weighted** — validated evidence contributes substantially more than self-report.
- **No fake precision** — display meaningful rounding (e.g. 73%, never 73.48291%).
- **Continuous, not binary** — "Career Readiness Estimate", "Market Alignment" and "Evidence Confidence" are phrases used instead of absolute "job-ready" claims.

## Skill gap engine

Compares current evidence against target-role requirements and produces: strengths, critical gaps, medium gaps, optional gaps, missing evidence, outdated skills, emerging skills.

> Important: "missing skill" ≠ "missing evidence". A student may know a skill but have no proof yet.

## Roadmap engine

Generates prioritized, action-oriented tasks from role requirements, current competency, evidence confidence, market demand, prerequisites and progress. Roadmaps update when the student improves, assessments change, market requirements change, or the target role changes.

## Next Best Action

A single highest-value action with a reason and an estimate ("Complete SQL Window Functions Assessment — SQL is high-priority for your role and evidence is below benchmark. ~45 min, high impact.").