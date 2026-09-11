import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { executeSql, executeCode } from '../services/execution.client.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

const SqlBody = z.object({
  query: z.string().min(1).max(5000),
  schema: z.string().optional(),
  expected: z.unknown().optional(),
});

router.post('/sql', async (req, res, next) => {
  try {
    const parsed = SqlBody.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed: query is required', 422);
    }
    res.json(await executeSql(parsed.data));
  } catch (err) {
    next(err);
  }
});

const CodeBody = z.object({
  language: z.string().min(1).max(20),
  code: z.string().min(1).max(20000),
  cases: z.array(z.unknown()).optional(),
});

router.post('/code', async (req, res, next) => {
  try {
    const parsed = CodeBody.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed: language and code are required', 422);
    }
    res.json(await executeCode(parsed.data));
  } catch (err) {
    next(err);
  }
});

export default router;