# Phase 21 — RAG-Grounded Coach

## Goal
Make the AI coach answer from the student's *actual* data, not just a generic
summary. When a message references a specific skill, project, plan, or fact,
the coach should ground its reply in the matching records rather than the
LLM's priors.

## What shipped (`packages/api`)
`services/coach.service.js` gains a lightweight retrieval layer that runs on
every `sendMessage`:

1. `tokenize(text)` — lowercase alphanumeric tokens with a stopword list.
2. `scoreChunk(queryTokens, chunkTokens)` — lexical overlap
   `overlap / sqrt(chunkLength)` so long documents don't dominate ranking.
3. `buildDomainDocuments(userId, readinessSummary, skillNameMap)` — collects
   the student's own documents:
   - **evidence** — per-record card (proficiency, confidence, source types),
     which includes resume-derived sources (the resume flows through Evidence);
   - **readiness** — per-role dimension + strengths / critical gaps +
     next-best-action text;
   - **roadmap** — open (non-done) tasks with action, reason, impact, effort;
   - **projects** — title, description, tech stack, skills used;
   - **market** — per-role market alignment explanation.
4. `retrieveContext(userQuery, docs)` — ranks docs against the message, keeps
   the top 6 above a minimum relevance score, and formats a
   `RETRIEVED NOTES (ranked by relevance…)` block with a `[source:label]`
   prefix and a relevance percentage so the model can trust/label provenance.
5. The retrieved block is appended to the existing context block before the
   LLM call; the assistant message's `context` now records `retrievedNotes`
   for transparency. `models/message.model.js` `coachContextSchema` gained the
   `retrievedNotes` Mixed field.

## Notes
- Retrieval is entirely on top of the read-only data the coach already had;
  no new data sources were added. Fallback behavior (no retrieved notes) is
  unchanged — the coach still answers from the readiness/evidence/market
  summary block when nothing matches.