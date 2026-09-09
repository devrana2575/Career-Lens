import { Skill } from '../models/skill.model.js';
import { Evidence } from '../models/evidence.model.js';
import { AppError } from '../utils/errors.js';
import { computeEvidenceScores } from './evidence.service.js';
import { analyzeResume as analyzeResumeRemote } from './resume.client.js';

const RESUME_TYPE = 'resume';

/**
 * Parses resume text, maps the detected skills onto the ontology, and records
 * a `resume` evidence source per matched skill. A fresh upload replaces an
 * earlier resume source for the same skill (the latest resume wins).
 *
 * Resume hits carry a prominence strength, never a numeric proficiency — the
 * evidence graph only derives a proficiency score from assessed sources.
 */
export async function analyzeResume(userId, { text, fileName }) {
  if (!text || !text.trim()) throw new AppError('Resume text is empty', 422);

  const remote = await analyzeResumeRemote({ text, fileName });
  const matched = remote.matchedSkills ?? [];
  if (matched.length === 0) {
    return { fileName: fileName ?? null, matched: 0, added: 0, skipped: 0, hits: [], note: remote.note ?? null };
  }

  const ids = [...new Set(matched.map((m) => m.skillId))];
  const active = new Set(
    (await Skill.find({ _id: { $in: ids }, isActive: { $ne: false } })).map((s) => String(s._id)),
  );

  const hits = [];
  for (const hit of matched) {
    if (!active.has(hit.skillId)) continue;

    let evidence = await Evidence.findOne({ userId, skillId: hit.skillId });
    if (!evidence) evidence = new Evidence({ userId, skillId: hit.skillId });

    evidence.sources = evidence.sources.filter((s) => s.type !== RESUME_TYPE);
    evidence.sources.push({
      type: RESUME_TYPE,
      strength: hit.strength,
      description: `${fileName ? `${fileName}: ` : ''}${hit.mentions} mention(s) detected from resume analysis`,
      occurredAt: new Date().toISOString(),
    });

    const { proficiencyScore, confidenceScore, lastEvaluatedAt } = computeEvidenceScores(evidence.sources);
    evidence.proficiencyScore = proficiencyScore;
    evidence.confidenceScore = confidenceScore;
    evidence.lastEvaluatedAt = lastEvaluatedAt;
    await evidence.save();

    hits.push({
      skillId: hit.skillId,
      skillName: hit.name,
      category: hit.category ?? null,
      mentions: hit.mentions,
      strength: hit.strength,
    });
  }

  return {
    fileName: fileName ?? null,
    matched: matched.length,
    added: hits.length,
    skipped: matched.length - hits.length,
    hits,
    note: remote.note ?? null,
  };
}