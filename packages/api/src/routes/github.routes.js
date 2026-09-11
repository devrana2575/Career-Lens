import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { analyzeGitHub } from '../services/github.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

const AnalyzeBody = z.object({
  username: z.string().min(1).max(100),
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
    res.json(await analyzeGitHub(req.user.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

export default router;
