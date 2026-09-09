import { Evidence } from '../models/evidence.model.js';
import { Skill } from '../models/skill.model.js';
import { AppError } from '../utils/errors.js';

const SELF_REPORTED = 'self_reported';
const STRENGTH_CONFIDENCE = { low: 30, medium: 60, high: 90 };

/**
 * Computes proficiency and confidence for a set of evidence sources.
 *
 * - `proficiencyScore` uses only numeric scores from non-self-reported
 *   sources (the strongest score wins). Self-reported scores are a
 *   fallback so an honest "where I think I am" still shows up low-stakes.
 * - `confidenceScore` starts from the strongest source's inherent
 *   strength, gains +5 for corroborating sources, and +5 when a source is
 *   recent (within 6 months). Capped at 100.
 *
 * Every score is traceable to the sources array returned beside it.
 */
export function computeEvidenceScores(sources, now = new Date()) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return { proficiencyScore: null, confidenceScore: 0 };
  }

  const scored = sources.filter((s) => typeof s.score === 'number');
  const nonSelfReported = scored.filter((s) => s.type !== SELF_REPORTED);
  const strongest = nonSelfReported.length > 0 ? nonSelfReported : scored;
  const proficiencyScore =
    strongest.length > 0
      ? Math.round(Math.max(...strongest.map((s) => s.score)))
      : null;

  let confidenceScore = Math.max(
    ...sources.map((s) => STRENGTH_CONFIDENCE[s.strength] ?? STRENGTH_CONFIDENCE.low),
  );
  const extraSources = sources.length - 1;
  if (extraSources > 0) confidenceScore += Math.min(5 * extraSources, 25);

  const cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  if (sources.some((s) => s.occurredAt && new Date(s.occurredAt) >= cutoff)) {
    confidenceScore += 5;
  }
  confidenceScore = Math.min(100, confidenceScore);

  const lastEvaluatedAt =
    sources
      .map((s) => s.occurredAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] ?? now.toISOString();

  return { proficiencyScore, confidenceScore, lastEvaluatedAt };
}

function cleanSource(source) {
  const cleaned = { type: source.type, strength: source.strength ?? 'low' };
  for (const key of ['referenceId', 'url', 'description', 'score']) {
    const value = source[key];
    if (value === undefined || value === null || value === '') continue;
    if (key === 'score' && typeof value !== 'number') continue;
    cleaned[key] = value;
  }
  if (source.occurredAt) cleaned.occurredAt = source.occurredAt;
  return cleaned;
}

async function resolveSkillInfos(skillIds) {
  const uniq = [...new Set(skillIds)];
  if (uniq.length === 0) return { map: new Map(), missing: [] };
  const skills = await Skill.find({ _id: { $in: uniq } }).lean();
  const map = new Map(skills.map((s) => [String(s._id), s]));
  const missing = uniq.filter((id) => !map.has(id));
  return { map, missing };
}

/**
 * Adds a source to the user's evidence for a skill, creating the evidence
 * record on first use. Throws AppError(422) when the skill is not part of
 * the ontology (no unexplained skills).
 */
export async function addEvidenceSource(userId, skillId, rawSource, competencyId = null) {
  const source = cleanSource(rawSource);
  if (!source?.type) throw new AppError('A source with a valid type is required', 422);

  const { missing } = await resolveSkillInfos([skillId]);
  if (missing.length > 0) throw new AppError('Unknown skill', 404);

  let evidence = await Evidence.findOne({ userId, skillId });
  if (!evidence) {
    evidence = new Evidence({ userId, skillId, competencyId });
  }

  evidence.sources.push(source);
  const { proficiencyScore, confidenceScore, lastEvaluatedAt } = computeEvidenceScores(
    evidence.sources,
  );
  evidence.proficiencyScore = proficiencyScore;
  evidence.confidenceScore = confidenceScore;
  evidence.lastEvaluatedAt = lastEvaluatedAt;
  await evidence.save();

  return evidence;
}

/**
 * The evidence graph: every assessed skill with its score, confidence and
 * the sources that explain it.
 */
export async function getEvidenceGraph(userId) {
  const records = await Evidence.find({ userId }).lean();
  const { map } = await resolveSkillInfos(records.map((r) => r.skillId));

  const skillAssessments = records
    .filter((r) => map.has(r.skillId))
    .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))
    .map((r) => ({
      skillId: r.skillId,
      skillName: map.get(r.skillId).name,
      proficiencyScore: r.proficiencyScore,
      confidenceScore: r.confidenceScore,
      sources: r.sources.map((s) => ({
        type: s.type,
        strength: s.strength,
        score: s.score,
        description: s.description,
        occurredAt: s.occurredAt,
      })),
    }));

  const lastUpdatedAt =
    records
      .map((r) => r.lastEvaluatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] ?? null;

  return { skillAssessments, lastUpdatedAt };
}

/** Lists raw evidence records (grouped, newest first) with resolved skill names. */
export async function listMyEvidence(userId) {
  const records = await Evidence.find({ userId }).sort({ updatedAt: -1 }).lean();
  const { map } = await resolveSkillInfos(records.map((r) => r.skillId));
  return records.map((r) => ({
    id: String(r._id),
    userId: r.userId,
    skillId: r.skillId,
    skillName: map.get(r.skillId)?.name ?? null,
    proficiencyScore: r.proficiencyScore,
    confidenceScore: r.confidenceScore,
    lastEvaluatedAt: r.lastEvaluatedAt,
    sources: r.sources,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getEvidenceById(userId, id) {
  return Evidence.findOne({ _id: id, userId }).lean();
}

export async function deleteEvidence(userId, id) {
  const res = await Evidence.deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
}

export function isSelfReportedOnly(sources) {
  return Array.isArray(sources) && sources.length > 0 && sources.every((s) => s.type === SELF_REPORTED);
}