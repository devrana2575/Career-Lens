import { Role } from '../models/role.model.js';
import { Skill } from '../models/skill.model.js';
import { RoleRequirement } from '../models/roleRequirement.model.js';
import { Evidence } from '../models/evidence.model.js';
import { Profile } from '../models/profile.model.js';
import { MarketSnapshot } from '../models/marketSnapshot.model.js';

const SELF_REPORTED = 'self_reported';
const STRENGTH_THRESHOLD = 70;

/**
 * Readiness engine (Phase 4).
 *
 * All scoring lives here — nothing in components or routes. Every number is
 * rounded to an integer (no fake precision) and every score carries reasons
 * via the gap/roadmap breakdown. "Missing skill" is kept distinct from
 * "missing evidence": the reason text says so explicitly.
 */

function evidenceQualityOf(sources) {
  if (!sources || sources.length === 0) return 'none';
  const nonSelf = sources.filter((s) => s.type !== SELF_REPORTED);
  if (nonSelf.length > 0) {
    return nonSelf.some((s) => typeof s.score === 'number') ? 'validated' : 'partial';
  }
  return 'self_reported';
}

/** Evidence-weighted factor: validated > partial > self-reported > none. */
function qualityFactor(quality) {
  if (quality === 'validated') return 1.0;
  if (quality === 'partial') return 0.85;
  if (quality === 'self_reported') return 0.75;
  return 0;
}

/** Builds the per-requirement analysis for a single role. */
export async function analyzeRole(userId, roleId) {
  const requirements = await RoleRequirement.find({ roleId }).lean();
  const skillIds = [...new Set(requirements.map((r) => r.skillId))];
  const skills = await Skill.find({ _id: { $in: skillIds } }).lean();
  const skillMap = new Map(skills.map((s) => [String(s._id), s]));

  const evidenceRecords = await Evidence.find({ userId, skillId: { $in: skillIds } }).lean();
  const evidenceMap = new Map(evidenceRecords.map((e) => [e.skillId, e]));

  const items = [];
  for (const req of requirements) {
    const skill = skillMap.get(String(req.skillId));
    if (!skill) continue;
    const evidence = evidenceMap.get(String(req.skillId));
    const quality = evidenceQualityOf(evidence?.sources ?? []);
    const rawProficiency =
      typeof evidence?.proficiencyScore === 'number' ? evidence.proficiencyScore : null;
    const hasScore = rawProficiency != null;
    const proficiency = hasScore ? rawProficiency : 0;
    const effective = Math.round(proficiency * qualityFactor(quality));
    items.push({
      skillId: String(skill._id),
      skillName: skill.name,
      category: skill.category,
      baselineLevel: req.baselineLevel,
      weight: req.weight,
      proficiency: rawProficiency,
      hasScore,
      quality,
      missingEvidence: quality === 'none',
      effective,
    });
  }

  return { items };
}

function technicalReadiness(items) {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (!totalWeight) return null;
  const covered = items.reduce((sum, i) => sum + i.weight * i.effective, 0);
  return Math.round(covered / totalWeight);
}

function professionalReadiness(items) {
  const soft = items.filter((i) => i.category === 'soft');
  if (soft.length === 0) return null;
  const totalWeight = soft.reduce((sum, i) => sum + i.weight, 0);
  const covered = soft.reduce((sum, i) => sum + i.weight * i.effective, 0);
  return Math.round(covered / totalWeight);
}

function evidenceConfidenceScore(items) {
  const assessed = items.filter((i) => i.quality !== 'none');
  if (assessed.length === 0) return null;
  const maxQuality = { none: 0, self_reported: 35, partial: 60, validated: 90 };
  const totalWeight = assessed.reduce((sum, i) => sum + i.weight, 0) || 1;
  const conf = assessed.reduce((sum, i) => sum + i.weight * maxQuality[i.quality], 0) / totalWeight;
  return Math.round(conf);
}

function splitGaps(items) {
  const strengths = [];
  const criticalGaps = [];
  const mediumGaps = [];
  const optionalGaps = [];
  const missingEvidence = [];

  for (const i of items) {
    if (i.proficiency >= STRENGTH_THRESHOLD) {
      strengths.push(i);
      continue;
    }
    if (i.missingEvidence) {
      missingEvidence.push(i);
      continue;
    }
    if (i.baselineLevel === 'critical') criticalGaps.push(i);
    else if (i.baselineLevel === 'required' || i.baselineLevel === 'preferred') mediumGaps.push(i);
    else optionalGaps.push(i);
  }

  const byWeight = (a, b) => b.weight - a.weight;
  criticalGaps.sort(byWeight);
  mediumGaps.sort(byWeight);
  optionalGaps.sort(byWeight);
  missingEvidence.sort(byWeight);
  strengths.sort((a, b) => b.proficiency - a.proficiency);

  return { strengths, criticalGaps, mediumGaps, optionalGaps, missingEvidence };
}

function gapToJson(i) {
  return {
    skillId: i.skillId,
    skillName: i.skillName,
    baselineLevel: i.baselineLevel,
    weight: i.weight,
    proficiency: i.proficiency,
    evidenceQuality: i.quality,
    missingEvidence: i.missingEvidence,
  };
}

const MIN_BENCHMARK_VOLUME = 5;

/**
 * Market alignment (Phase 9).
 *
 * Compares the student's evidence-weighted proficiency on a role's required
 * skills against the skills that actually appear in the role's latest market
 * postings. Alignment only covers skills the market lists as demanded; skills
 * with no benchmark coverage are excluded rather than guessed. If there is no
 * benchmark or its confidence is insufficient the number stays null.
 */
async function computeMarketAlignment(roleId, roleName, items) {
  const empty = { alignment: null, marketExplanation: null, marketShares: new Map() };
  const latest = await MarketSnapshot.find({ roleId })
    .sort({ snapshotDate: -1 })
    .limit(1)
    .lean();
  if (latest.length === 0) {
    return {
      ...empty,
      marketExplanation: `No market benchmark has been recorded for ${roleName} yet, so market alignment stays blank rather than guessed.`,
    };
  }
  const latestDate = latest[0].snapshotDate;
  const daySnapshots = await MarketSnapshot.find({ roleId, snapshotDate: latestDate }).lean();
  const jobCount = daySnapshots.reduce((sum, s) => sum + (s.jobCount || 0), 0);
  const skillTotals = new Map();
  for (const s of daySnapshots) {
    for (const { skillId, count } of s.skillFrequencies ?? []) {
      skillTotals.set(String(skillId), (skillTotals.get(String(skillId)) || 0) + (count || 0));
    }
  }
  if (jobCount < MIN_BENCHMARK_VOLUME) {
    return {
      ...empty,
      marketExplanation: `Market data for ${roleName} is still too sparse (${jobCount} postings) to align against — this stays blank until there is enough demand data.`,
    };
  }

  const marketShares = new Map(
    [...skillTotals].map(([skillId, count]) => [skillId, jobCount ? count / jobCount : 0]),
  );

  const candidates = items.filter((i) => marketShares.has(i.skillId));
  if (candidates.length === 0) {
    return {
      ...empty,
      marketShares,
      marketExplanation: `${roleName} has a market benchmark, but none of its required skills appear in the latest postings.`,
    };
  }

  const weightTotal = candidates.reduce((sum, i) => sum + i.weight, 0);
  if (!weightTotal) {
    return { ...empty, marketShares };
  }
  const covered = candidates.reduce((sum, i) => {
    const coverage = i.hasScore ? Math.min(1, i.proficiency / 100) * qualityFactor(i.quality) : 0;
    return sum + i.weight * coverage;
  }, 0);
  const alignment = Math.round((covered / weightTotal) * 100);
  const demonstrated = candidates.filter((i) => i.hasScore).length;

  return {
    alignment,
    marketExplanation:
      `${roleName} benchmarks show ${demonstrated} of ${candidates.length} market-demanded skills with evidence. ` +
      `Alignment is the evidence-weighted share of those skills — it stays low until proficiency is proven, not claimed.`,
    marketShares,
  };
}

const EFFORT_ESTIMATE = {
  language: '~2 weeks of focused practice',
  library: '~1 week',
  framework: '~2 weeks',
  database: '~1 week',
  tool: '~2-3 days',
  concept: '~1 week of study',
  soft: '~4-6 weeks with deliberate practice',
};

function buildRoadmap({ criticalGaps, mediumGaps, optionalGaps, missingEvidence }, marketShares = new Map(), roleName = 'role') {
  const roadmap = [];
  const push = (item, impact) => {
    const base = gapToJson(item);
    const skill = item;
    let reason = item.missingEvidence
      ? `${skill.skillName} is ${item.baselineLevel} for this role and has no evidence yet. Evidence, not just claimed knowledge, drives the estimate.`
      : `${skill.skillName} is ${item.baselineLevel} for this role (current proficiency ${item.proficiency ?? 'unknown'}).`;
    const share = marketShares.get(item.skillId);
    if (typeof share === 'number' && share > 0) {
      reason += ` It also appears in ${Math.round(share * 100)}% of recent ${roleName} postings, so closing this gap raises market alignment.`;
    }
    roadmap.push({
      skillId: base.skillId,
      skillName: base.skillName,
      action: item.missingEvidence
        ? `Record evidence for ${item.skillName}`
        : `Improve ${item.skillName}`,
      reason,
      impact,
      effortEstimate: EFFORT_ESTIMATE[item.category] ?? null,
    });
  };

  for (const item of criticalGaps) push(item, 'high');
  for (const item of missingEvidence.filter((i) => i.baselineLevel === 'critical')) push(item, 'high');
  for (const item of mediumGaps) push(item, 'medium');
  for (const item of missingEvidence.filter((i) => i.baselineLevel === 'required')) push(item, 'medium');
  for (const item of optionalGaps) push(item, 'low');
  for (const item of missingEvidence.filter((i) => ['preferred', 'optional'].includes(i.baselineLevel))) {
    push(item, 'low');
  }

  return roadmap;
}

export async function computeReadinessReport(userId) {
  const { targetRoleIds = [] } = await loadProfileTargets(userId);
  const roles = [];
  let explanation = 'Set a target role to receive your readiness estimate.';

  const seenRoleIds = new Set();
  for (const roleIdOrSlug of targetRoleIds) {
    if (seenRoleIds.has(roleIdOrSlug)) continue;
    seenRoleIds.add(roleIdOrSlug);

    const role = await Role.findOne({
      $or: [{ _id: roleIdOrSlug }, { slug: roleIdOrSlug }],
      isActive: true,
    }).lean();
    if (!role) continue;

    const { items } = await analyzeRole(userId, String(role._id));
    if (items.length === 0) continue;

    const market = await computeMarketAlignment(String(role._id), role.name, items);
    const marketShares = market.marketShares;

    const technical = technicalReadiness(items);
    const professional = professionalReadiness(items);
    const evidenceConfidence = evidenceConfidenceScore(items);
    const { strengths, criticalGaps, mediumGaps, optionalGaps, missingEvidence } = splitGaps(items);
    const roadmap = buildRoadmap(
      { strengths, criticalGaps, mediumGaps, optionalGaps, missingEvidence },
      marketShares,
      role.name,
    );

    roles.push({
      roleId: String(role._id),
      roleName: role.name,
      roleSlug: role.slug,
      overall: technical,
      dimensions: {
        technical,
        professional,
        marketAlignment: market.alignment,
        evidenceConfidence,
      },
      marketExplanation: market.marketExplanation,
      strengths: strengths.map(gapToJson),
      criticalGaps: criticalGaps.map(gapToJson),
      mediumGaps: mediumGaps.map(gapToJson),
      optionalGaps: optionalGaps.map(gapToJson),
      missingEvidence: missingEvidence.map((i) => ({
        ...gapToJson(i),
        note: 'Missing evidence does not mean missing skill.',
      })),
      roadmap,
      nextBestAction: roadmap[0] ?? null,
    });
  }

  let anyAligned = false;
  for (const role of roles) {
    if (role.dimensions.marketAlignment != null) anyAligned = true;
  }

  if (roles.length > 0) {
    explanation =
      'Overall readiness is the evidence-weighted coverage of role requirements. ' +
      (anyAligned
        ? 'Market alignment compares the skills you can prove against the skills in recent role postings.'
        : 'Market alignment stays blank until a market benchmark is connected — no fabricated numbers.');
  }

  const timestamps = await Evidence.find({ userId }).sort({ updatedAt: -1 }).limit(1).lean();
  return {
    roles,
    explanation,
    lastUpdatedAt: timestamps[0]?.updatedAt ?? null,
  };
}

async function loadProfileTargets(userId) {
  const profile = await Profile.findOne({ userId }).lean();
  return { targetRoleIds: profile?.targetRoleIds ?? [] };
}