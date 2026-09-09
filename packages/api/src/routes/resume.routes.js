import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { analyzeResume } from '../services/resume.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

const AnalyzeBody = z.object({
  text: z.string().min(1).max(50000),
  fileName: z.string().trim().max(200).optional(),
});

router.post('/analyze', async (req, res, next) => {
  try {
    const parsed = AnalyzeBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    res.json(await analyzeResume(req.user.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

export default router;