import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { analyzeResume } from '../services/resume.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

const VALID_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.text', '.markdown']);

const AnalyzeBody = z.object({
  text: z
    .string()
    .min(1)
    .max(50_000)
    .refine((value) => !value.includes('\u0000'), {
      message: 'Text contains NUL bytes',
    }),
  fileName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine(
      (name) => {
        if (!name) return true;
        const dotIndex = name.lastIndexOf('.');
        if (dotIndex <= 0) return false;
        const ext = name.slice(dotIndex).toLowerCase();
        return VALID_TEXT_EXTENSIONS.has(ext);
      },
      { message: 'Only .txt, .md, .text, or .markdown files are accepted' },
    ),
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