# Product

## Vision

An evidence-based career intelligence platform that continuously helps students understand, demonstrate, and improve their readiness for real technology roles — and helps recruiters evaluate candidates on evidence instead of claims.

The platform answers four questions:

1. What does the market expect for my target role?
2. What can I actually demonstrate?
3. Where are my gaps?
4. What should I do next?

## Principles

1. **Evidence over self-report.** Readiness estimates are driven by validated evidence — assessments, projects, resume, GitHub, external practice. Self-reported skill scores are supplementary only and carry substantially less weight.
2. **Explainable scores.** Every important score is traceable to evidence. "Why does this score exist?" must always be answerable.
3. **No fake precision.** Readiness is a *continuous estimate*, not a permanent binary state. Use rounded, meaningful numbers and label absolute claims as estimates.
4. **Data-driven roles.** Roles, competencies, skills, aliases and requirements live in the database, never hardcoded in components or modules.
5. **Market-aware, honestly.** Role benchmarks derive from legitimate job-market signals. When data is insufficient, the system says so instead of fabricating statistics.
6. **Action-oriented.** Recommendations are concrete ("Complete 10 Array/Hashing problems at Easy/Medium, then take the checkpoint assessment"), not vague ("learn DSA").
7. **Data honesty.** Demo data is labeled DEMO DATA. Nothing is fabricated: no fake GitHub evidence, no fake assessment results, no invented market stats.

## Core loop

```
LEARN → PRACTICE → BUILD → PROVE → MEASURE → IDENTIFY GAPS → IMPROVE → REASSESS → REPEAT
```

"Job ready" is never a final state. The platform provides a continuously updated estimate from current evidence, current assessments, target-role requirements, current market signals, recent activity, competency coverage and evidence confidence.

## Users

### Students
Create profile, upload resume, connect GitHub, select target role, take technical assessments, track external DSA practice, submit projects, view evidence-backed skill profile, see skill gaps, follow a personalized roadmap, interact with the AI career coach, and compare roles.

### Recruiters
Define target roles and required competencies, review candidates, inspect evidence, compare candidates, see candidate-role alignment, assessment results, strengths/gaps, and shortlist on evidence.

## MVP definition

The first genuinely usable MVP lets a student:

1. Create an account
2. Create a profile
3. Select a target role
4. See required competencies
5. Take technical assessments
6. Add projects
7. Upload a resume
8. Add GitHub
9. Add external practice evidence
10. See the evidence-backed skill profile
11. See the readiness estimate
12. See skill gaps
13. Receive personalized next actions
14. Track progress

## Scope guard

Every feature must answer at least one of:

- Does it help students become more capable?
- Does it produce stronger evidence?
- Does it improve career decisions?
- Does it improve personalization?
- Does it improve recruiter decision-making?

Build a smaller, real system before a larger, beautiful one. Do not build a beautiful fake.