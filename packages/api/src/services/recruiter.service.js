import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { Evidence } from '../models/evidence.model.js';
import { Shortlist } from '../models/shortlist.model.js';
import { Skill } from '../models/skill.model.js';
import { computeReadinessReport } from './readiness.service.js';
import { AppError } from '../utils/errors.js';

async function buildCandidateSummary(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const profile = await Profile.findOne({ userId }).lean();
  const evidenceRecords = await Evidence.find({ userId }).lean();
  const evidenceCount = evidenceRecords.length;

  // Resolve target roles
  const targetRoleIds = profile?.targetRoleIds ?? [];
  const { Role } = await import('../models/role.model.js');
  const roles = await Role.find({ _id: { $in: targetRoleIds } }).lean();
  const targetRoles = roles.map((r) => ({ roleId: String(r._id), roleName: r.name }));

  // Top skills by confidence
  const { Skill: SkillModel } = await import('../models/skill.model.js');
  const skillIds = evidenceRecords.map((e) => e.skillId);
  const skillDocs = await SkillModel.find({ _id: { $in: skillIds } }).lean();
  const skillNameMap = new Map(skillDocs.map((s) => [String(s._id), s.name]));

  const topSkills = evidenceRecords
    .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))
    .slice(0, 5)
    .map((e) => ({
      skillName: skillNameMap.get(e.skillId) ?? e.skillId,
      confidenceScore: e.confidenceScore ?? 0,
    }));

  // Readiness score (overall of first target role)
  let readinessScore = null;
  if (targetRoleIds.length > 0) {
    try {
      const report = await computeReadinessReport(userId);
      if (report.roles.length > 0) {
        readinessScore = report.roles[0].overall;
      }
    } catch {
      // readiness may fail for some users, that's ok
    }
  }

  return {
    userId: String(user._id),
    displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Unknown',
    email: user.email ?? '',
    headline: profile?.headline ?? null,
    location: profile?.location ?? null,
    targetRoles,
    readinessScore,
    evidenceCount,
    topSkills,
    githubUsername: profile?.githubUsername ?? null,
  };
}

export async function listCandidates(recruiterId, { roleId, minReadiness, skillSearch } = {}) {
  // Only students are candidates
  const users = await User.find({ role: 'student', isActive: { $ne: false } })
    .select('_id')
    .lean();

  const summaries = [];
  for (const u of users) {
    const summary = await buildCandidateSummary(String(u._id));
    if (!summary) continue;

    // Filter by role
    if (roleId && !summary.targetRoles.some((r) => r.roleId === roleId)) continue;

    // Filter by min readiness
    if (minReadiness != null && (summary.readinessScore ?? 0) < minReadiness) continue;

    // Filter by skill search
    if (skillSearch) {
      const q = skillSearch.toLowerCase();
      const hasSkill = summary.topSkills.some((s) => s.skillName.toLowerCase().includes(q));
      if (!hasSkill) continue;
    }

    summaries.push(summary);
  }

  return summaries;
}

export async function getCandidateDetail(candidateId) {
  const summary = await buildCandidateSummary(candidateId);
  if (!summary) throw new AppError('Candidate not found', 404);

  const profile = await Profile.findOne({ userId: candidateId }).lean();

  // Full readiness reports
  let readinessReports = [];
  try {
    const report = await computeReadinessReport(candidateId);
    readinessReports = report.roles;
  } catch {
    // ok
  }

  // Recent evidence
  const evidenceRecords = await Evidence.find({ candidateId })
    .sort({ updatedAt: -1 })
    .limit(10)
    .lean();
  const skillIds = evidenceRecords.map((e) => e.skillId);
  const skills = await Skill.find({ _id: { $in: skillIds } }).lean();
  const skillNameMap = new Map(skills.map((s) => [String(s._id), s.name]));

  const recentEvidence = evidenceRecords.map((e) => ({
    id: String(e._id),
    skillName: skillNameMap.get(e.skillId) ?? e.skillId,
    proficiencyScore: e.proficiencyScore,
    confidenceScore: e.confidenceScore,
    sources: e.sources,
    updatedAt: e.updatedAt,
  }));

  return {
    ...summary,
    bio: profile?.bio ?? null,
    yearsOfExperience: profile?.yearsOfExperience ?? null,
    education: profile?.education ?? [],
    readinessReports,
    recentEvidence,
  };
}

export async function compareCandidates(recruiterId, candidateIds) {
  if (!candidateIds || candidateIds.length < 2) {
    throw new AppError('At least 2 candidate IDs are required', 422);
  }
  if (candidateIds.length > 5) {
    throw new AppError('Cannot compare more than 5 candidates at once', 422);
  }

  const candidates = [];
  for (const id of candidateIds) {
    try {
      const detail = await getCandidateDetail(id);
      candidates.push(detail);
    } catch {
      // skip missing candidates
    }
  }
  return { candidates };
}

export async function createShortlist(recruiterId, { name, candidateIds = [] }) {
  const shortlist = new Shortlist({ recruiterId, name, candidateIds });
  await shortlist.save();
  return shortlist.toJSON();
}

export async function listShortlists(recruiterId) {
  return Shortlist.find({ recruiterId }).sort({ createdAt: -1 }).lean();
}

export async function getShortlist(recruiterId, shortlistId) {
  const sl = await Shortlist.findOne({ _id: shortlistId, recruiterId }).lean();
  if (!sl) throw new AppError('Shortlist not found', 404);
  return sl;
}

export async function updateShortlist(recruiterId, shortlistId, update) {
  const sl = await Shortlist.findOne({ _id: shortlistId, recruiterId });
  if (!sl) throw new AppError('Shortlist not found', 404);
  if (update.name !== undefined) sl.name = update.name;
  if (update.candidateIds !== undefined) sl.candidateIds = update.candidateIds;
  await sl.save();
  return sl.toJSON();
}

export async function deleteShortlist(recruiterId, shortlistId) {
  const result = await Shortlist.deleteOne({ _id: shortlistId, recruiterId });
  if (result.deletedCount === 0) throw new AppError('Shortlist not found', 404);
  return true;
}
