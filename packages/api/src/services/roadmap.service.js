import { Roadmap } from '../models/roadmap.model.js';
import { Role } from '../models/role.model.js';
import { Profile } from '../models/profile.model.js';
import { AppError } from '../utils/errors.js';
import {
  analyzeRole,
  computeMarketAlignment,
  splitGaps,
  buildRoadmap,
} from './readiness.service.js';

function toRoadmapJson(roadmap) {
  const open = roadmap.tasks.filter((t) => t.status !== 'done').length;
  return {
    id: String(roadmap._id),
    roleId: roadmap.roleId,
    roleSlug: roadmap.roleSlug ?? null,
    roleName: roadmap.roleName,
    progress: roadmap.tasks.length === 0 ? 0 : Math.round(((roadmap.tasks.length - open) / roadmap.tasks.length) * 100),
    tasks: roadmap.tasks,
    generatedAt: roadmap.generatedAt,
    updatedAt: roadmap.updatedAt,
  };
}

/**
 * Recomputes the personalized roadmap for every target role from the current
 * readiness snapshot. Completion state is preserved per skill across
 * regenerations, so checking off work survives new readiness data.
 */
export async function generateRoadmaps(userId) {
  const profile = await Profile.findOne({ userId }).lean();
  const targetRoleIds = profile?.targetRoleIds ?? [];

  const fresh = [];
  const seen = new Set();
  for (const roleIdOrSlug of targetRoleIds) {
    if (seen.has(roleIdOrSlug)) continue;
    seen.add(roleIdOrSlug);

    const role = await Role.findOne({
      $or: [{ _id: roleIdOrSlug }, { slug: roleIdOrSlug }],
      isActive: true,
    }).lean();
    if (!role) continue;

    const { items } = await analyzeRole(userId, String(role._id));
    if (items.length === 0) continue;

    const market = await computeMarketAlignment(String(role._id), role.name, items);
    const marketShares = market.marketShares;
    const { criticalGaps, mediumGaps, optionalGaps, missingEvidence } = splitGaps(items);
    const tasks = buildRoadmap(
      { criticalGaps, mediumGaps, optionalGaps, missingEvidence },
      marketShares,
      role.name,
    ).map((t) => ({ ...t, id: `task-${t.skillId}` }));

    fresh.push({
      roleId: String(role._id),
      roleSlug: role.slug,
      roleName: role.name,
      tasks,
      marketExplanation: market.marketExplanation,
    });
  }

  const saved = [];
  for (const entry of fresh) {
    const existing = await Roadmap.findOne({ userId, roleId: entry.roleId });
    const doneSkills = new Map(
      (existing?.tasks ?? []).filter((t) => t.status === 'done').map((t) => [t.skillId, t.completedAt]),
    );
    const tasks = entry.tasks.map((t) => ({
      ...t,
      status: doneSkills.has(t.skillId) ? 'done' : 'open',
      completedAt: doneSkills.get(t.skillId) ?? null,
    }));

    let doc = existing;
    if (doc) {
      doc.tasks = tasks;
      doc.roleName = entry.roleName;
      doc.roleSlug = entry.roleSlug;
      doc.generatedAt = new Date();
      await doc.save();
    } else {
      doc = new Roadmap({
        userId,
        roleId: entry.roleId,
        roleSlug: entry.roleSlug,
        roleName: entry.roleName,
        tasks,
        generatedAt: new Date(),
      });
      await doc.save();
    }
    saved.push(toRoadmapJson(doc));
  }

  return { roadmaps: saved };
}

export async function listRoadmaps(userId) {
  const docs = await Roadmap.find({ userId }).sort({ updatedAt: -1 });
  return { roadmaps: docs.map(toRoadmapJson) };
}

export async function toggleTask(userId, roadmapId, taskId) {
  const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
  if (!roadmap) throw new AppError('Roadmap not found', 404);

  const task = roadmap.tasks.find((t) => t.id === taskId);
  if (!task) throw new AppError('Task not found', 404);

  if (task.status === 'done') {
    task.status = 'open';
    task.completedAt = null;
  } else {
    task.status = 'done';
    task.completedAt = new Date();
  }
  await roadmap.save();
  return toRoadmapJson(roadmap);
}

export async function deleteRoadmap(userId, roadmapId) {
  const roadmap = await Roadmap.findOneAndDelete({ _id: roadmapId, userId });
  if (!roadmap) throw new AppError('Roadmap not found', 404);
  return true;
}