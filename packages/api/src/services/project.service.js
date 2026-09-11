import { Project } from '../models/project.model.js';
import { Skill } from '../models/skill.model.js';
import { Evidence } from '../models/evidence.model.js';
import { AppError } from '../utils/errors.js';
import { computeEvidenceScores } from './evidence.service.js';

const PROJECT_TYPE = 'project';

function computeProjectStrength(project) {
  let score = 0;
  if (project.description && project.description.length > 20) score++;
  if (project.url) score++;
  if (project.repoUrl) score++;
  if (project.skillsUsed && project.skillsUsed.length >= 3) score += 2;
  else if (project.skillsUsed && project.skillsUsed.length >= 1) score += 1;
  if (project.techStack && project.techStack.length >= 3) score++;
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

async function recordProjectEvidence(userId, project) {
  if (!project.skillsUsed || project.skillsUsed.length === 0) return;

  const skillIds = project.skillsUsed.map((s) => s.skillId);
  const active = new Set(
    (await Skill.find({ _id: { $in: skillIds }, isActive: { $ne: false } })).map((s) => String(s._id)),
  );

  const strength = computeProjectStrength(project);

  for (const skill of project.skillsUsed) {
    if (!active.has(skill.skillId)) continue;

    let evidence = await Evidence.findOne({ userId, skillId: skill.skillId });
    if (!evidence) evidence = new Evidence({ userId, skillId: skill.skillId });

    evidence.sources = evidence.sources.filter(
      (s) => !(s.type === PROJECT_TYPE && s.referenceId === String(project._id)),
    );

    evidence.sources.push({
      type: PROJECT_TYPE,
      strength,
      referenceId: String(project._id),
      description: `Project "${project.title}"`,
      url: project.repoUrl || project.url || null,
      occurredAt: (project.endDate || project.startDate || new Date()).toISOString(),
    });

    const { proficiencyScore, confidenceScore, lastEvaluatedAt } = computeEvidenceScores(evidence.sources);
    evidence.proficiencyScore = proficiencyScore;
    evidence.confidenceScore = confidenceScore;
    evidence.lastEvaluatedAt = lastEvaluatedAt;
    await evidence.save();
  }
}

async function removeProjectEvidence(userId, project) {
  if (!project.skillsUsed || project.skillsUsed.length === 0) return;

  for (const skill of project.skillsUsed) {
    const evidence = await Evidence.findOne({ userId, skillId: skill.skillId });
    if (!evidence) continue;

    evidence.sources = evidence.sources.filter(
      (s) => !(s.type === PROJECT_TYPE && s.referenceId === String(project._id)),
    );

    const { proficiencyScore, confidenceScore, lastEvaluatedAt } = computeEvidenceScores(evidence.sources);
    evidence.proficiencyScore = proficiencyScore;
    evidence.confidenceScore = confidenceScore;
    evidence.lastEvaluatedAt = lastEvaluatedAt;
    await evidence.save();
  }
}

export async function createProject(userId, input) {
  const project = new Project({ userId, ...input });
  await project.save();
  await recordProjectEvidence(userId, project);
  return project.toJSON();
}

export async function updateProject(userId, projectId, input) {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) throw new AppError('Project not found', 404);

  await removeProjectEvidence(userId, project);

  Object.assign(project, input);
  await project.save();
  await recordProjectEvidence(userId, project);
  return project.toJSON();
}

export async function deleteProject(userId, projectId) {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) throw new AppError('Project not found', 404);

  await removeProjectEvidence(userId, project);
  await project.deleteOne();
  return true;
}

export async function listProjects(userId) {
  const projects = await Project.find({ userId }).sort({ startDate: -1, createdAt: -1 }).lean();
  return projects.map((p) => ({
    id: String(p._id),
    userId: p.userId,
    title: p.title,
    description: p.description,
    url: p.url,
    repoUrl: p.repoUrl,
    techStack: p.techStack,
    skillsUsed: p.skillsUsed,
    startDate: p.startDate,
    endDate: p.endDate,
    isOngoing: p.isOngoing,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

export async function getProjectById(userId, projectId) {
  const project = await Project.findOne({ _id: projectId, userId }).lean();
  if (!project) throw new AppError('Project not found', 404);
  return {
    id: String(project._id),
    userId: project.userId,
    title: project.title,
    description: project.description,
    url: project.url,
    repoUrl: project.repoUrl,
    techStack: project.techStack,
    skillsUsed: project.skillsUsed,
    startDate: project.startDate,
    endDate: project.endDate,
    isOngoing: project.isOngoing,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
