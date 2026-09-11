import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  getProjectById,
} from '../services/project.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

const SkillUsedInput = z.object({
  skillSlug: z.string().min(1).max(200),
  skillId: z.string().min(1).max(200),
  role: z.string().max(100).optional(),
});

const CreateBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  url: z.string().url().max(2000).optional().nullable(),
  repoUrl: z.string().url().max(2000).optional().nullable(),
  techStack: z.array(z.string().max(100)).max(20).default([]),
  skillsUsed: z.array(SkillUsedInput).default([]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isOngoing: z.boolean().default(false),
});

const UpdateBody = CreateBody.partial();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listProjects(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getProjectById(req.user.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    const project = await createProject(req.user.id, parsed.data);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    res.json(await updateProject(req.user.id, req.params.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteProject(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
