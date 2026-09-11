import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  listApplications,
  applyToJob,
  updateApplication,
  withdrawApplication,
} from '../services/application.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/applications', async (req, res, next) => {
  try {
    res.json(await listApplications(req.user.id));
  } catch (err) {
    next(err);
  }
});

const ApplyBody = z.object({
  jobId: z.string().min(1),
});

router.post('/applications', async (req, res, next) => {
  try {
    const parsed = ApplyBody.safeParse(req.body);
    if (!parsed.success) throw new AppError('Validation failed', 422);
    const application = await applyToJob(req.user.id, parsed.data);
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
});

const UpdateBody = z.object({
  status: z.enum(['applied', 'interviewing', 'offered', 'rejected', 'withdrawn']).optional(),
  notes: z.string().max(2000).optional(),
});

router.patch('/applications/:id', async (req, res, next) => {
  try {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) throw new AppError('Validation failed', 422);
    res.json(await updateApplication(req.user.id, req.params.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

router.delete('/applications/:id', async (req, res, next) => {
  try {
    await withdrawApplication(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;