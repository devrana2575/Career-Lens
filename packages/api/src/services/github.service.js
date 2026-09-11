import { Skill } from '../models/skill.model.js';
import { Evidence } from '../models/evidence.model.js';
import { AppError } from '../utils/errors.js';
import { computeEvidenceScores } from './evidence.service.js';
import { analyzeGitHub as analyzeGitHubRemote } from './github.client.js';

const GITHUB_TYPE = 'github';

/**
 * Fetches GitHub profile + repos, maps detected skills onto the ontology,
 * and records a `github` evidence source per matched skill. A fresh analysis
 * replaces earlier github sources for the same skill (latest analysis wins).
 *
 * GitHub hits carry a strength based on repo count, never a numeric proficiency.
 */
export async function analyzeGitHub(userId, { username }) {
  if (!username || !username.trim()) throw new AppError('GitHub username is empty', 422);

  const remote = await analyzeGitHubRemote({ username });
  const matched = remote.matchedSkills ?? [];
  if (matched.length === 0) {
    return {
      username,
      matched: 0,
      added: 0,
      skipped: 0,
      hits: [],
      stats: remote.stats ?? null,
      note: remote.note ?? null,
    };
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

    evidence.sources = evidence.sources.filter((s) => s.type !== GITHUB_TYPE);

    const repoSummary = hit.topRepos?.length
      ? `Top repos: ${hit.topRepos.map((r) => r.name).join(', ')}`
      : '';

    evidence.sources.push({
      type: GITHUB_TYPE,
      strength: hit.strength,
      description: `${hit.repoCount} repo(s) detected from GitHub analysis${repoSummary ? ` — ${repoSummary}` : ''}`,
      url: `https://github.com/${username}`,
      occurredAt: new Date().toISOString(),
    });

    const { proficiencyScore, confidenceScore, lastEvaluatedAt } = computeEvidenceScores(evidence.sources);
    evidence.proficiencyScore = proficiencyScore;
    evidence.confidenceScore = confidenceScore;
    evidence.lastEvaluatedAt = lastEvaluatedAt;
    await evidence.save();

    hits.push({
      skillId: hit.skillId,
      skillName: hit.skillName,
      strength: hit.strength,
      repoCount: hit.repoCount,
      topRepos: hit.topRepos,
    });
  }

  return {
    username,
    matched: matched.length,
    added: hits.length,
    skipped: matched.length - hits.length,
    hits,
    stats: remote.stats ?? null,
    note: remote.note ?? null,
  };
}
