import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Job } from '../models/job.model.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/jobs', async (req, res, next) => {
  try {
    const { title } = req.query;
    const filter = { isActive: { $ne: false } };
    if (title) filter.title = { $regex: String(title), $options: 'i' };
    const jobs = await Job.find(filter).sort({ collectedDate: -1 }).limit(100).lean();
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

const CreateJobBody = z.object({
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  description: z.string().max(10000).optional(),
  experienceYears: z.number().min(0).optional(),
  roleId: z.string().optional(),
});

router.get('/jobs/mine', requireRole('recruiter', 'admin'), async (req, res, next) => {
  try {
    const jobs = await Job.find({ recruiterId: req.user.id }).sort({ collectedDate: -1 }).lean();
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

router.post('/jobs', requireRole('recruiter', 'admin'), async (req, res, next) => {
  try {
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) throw new AppError('Validation failed', 422, parsed.error.issues);
    const job = await Job.create({
      _id: crypto.randomUUID(),
      ...parsed.data,
      recruiterId: req.user.id,
      isActive: true,
      isDemo: true,
      collectedDate: new Date().toISOString(),
    });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

export default router;