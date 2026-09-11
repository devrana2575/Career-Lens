import { AppError } from '../utils/errors.js';
import { computeRoleSnapshot } from './readiness.service.js';
import { getRoleWithDetails } from './role.service.js';
import { getRoleBenchmark } from './market.service.js';

/**
 * Side-by-side role comparison for students (Phase 19).
 *
 * Each role gets its readiness snapshot, its market benchmark, and its
 * requirement rows joined with the student's current proficiency, evidence
 * quality, and market share. Nothing here is fabricated — blank values mean
 * the underlying data does not exist yet.
 */
export async function compareRoles(userId, roleIdsOrSlugs) {
  const roles = [];

  for (const ref of roleIdsOrSlugs) {
    const snapshot = await computeRoleSnapshot(userId, ref);
    if (!snapshot) continue;

    const details = await getRoleWithDetails(ref);
    const benchmark = await getRoleBenchmark(ref);

    const skills = snapshot.items.map((item) => ({
      skillId: item.skillId,
      skillName: item.skillName,
      category: item.category,
      baselineLevel: item.baselineLevel,
      weight: item.weight,
      proficiency: item.proficiency,
      hasScore: item.hasScore,
      quality: item.quality,
      marketShare:
        typeof snapshot.marketShares.get(item.skillId) === 'number'
          ? Math.round(snapshot.marketShares.get(item.skillId) * 100)
          : null,
    }));

    roles.push({
      id: snapshot.roleId,
      name: snapshot.roleName,
      slug: snapshot.roleSlug,
      family: details?.family ?? null,
      description: details?.description ?? null,
      dimensions: {
        technical: snapshot.technical,
        professional: snapshot.professional,
        evidenceConfidence: snapshot.evidenceConfidence,
        marketAlignment: snapshot.marketAlignment,
      },
      marketExplanation: snapshot.marketExplanation,
      strengths: snapshot.strengths,
      criticalGaps: snapshot.criticalGaps,
      mediumGaps: snapshot.mediumGaps,
      optionalGaps: snapshot.optionalGaps,
      missingEvidence: snapshot.missingEvidence,
      benchmark: benchmark?.topSkills?.length
        ? {
            snapshotDate: benchmark.snapshotDate,
            jobVolume: benchmark.jobVolume,
            confidence: benchmark.confidence,
            demand: benchmark.demand,
            topSkills: benchmark.topSkills,
          }
        : null,
      skills,
    });
  }

  return { roles };
}

export function validateCompareRoles(slugs) {
  const list = Array.isArray(slugs)
    ? slugs
    : String(slugs ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  if (list.length < 2) {
    throw new AppError('Select at least 2 roles to compare', 422);
  }
  if (list.length > 4) {
    throw new AppError('Compare at most 4 roles at once', 422);
  }
  return list;
}