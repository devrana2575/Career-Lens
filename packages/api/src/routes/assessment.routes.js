import { Router } from 'express';
import { ReviewAttemptInputSchema, SubmitAttemptInputSchema } from '@career/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';
import {
  listAssessments,
  startAssessment,
  submitAttempt,
  listMyAttempts,
  getAttemptById,
  listPendingAttempts,
  reviewAttempt,
} from '../services/assessment.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listAssessments());
  } catch (err) {
    next(err);
  }
});

router.get('/attempts', async (req, res, next) => {
  try {
    res.json(await listMyAttempts(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get(
  '/attempts/pending',
  requireRole('admin', 'mentor'),
  async (_req, res, next) => {
    try {
      res.json(await listPendingAttempts());
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/attempts/:id/review',
  requireRole('admin', 'mentor'),
  validate(ReviewAttemptInputSchema),
  async (req, res, next) => {
    try {
      res.json(await reviewAttempt(req.user.id, req.params.id, req.body.review));
    } catch (err) {
      next(err);
    }
  },
);

router.get('/attempts/:id', async (req, res, next) => {
  try {
    const result = await getAttemptById(req.user.id, req.params.id);
    if (!result) throw new AppError('Attempt not found', 404);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    res.status(201).json(await startAssessment(req.user.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/attempts/:id/submit', validate(SubmitAttemptInputSchema), async (req, res, next) => {
  try {
    res.json(await submitAttempt(req.user.id, req.params.id, req.body.answers));
  } catch (err) {
    next(err);
  }
});

export default router;