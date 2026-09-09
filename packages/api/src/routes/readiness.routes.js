import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { computeReadinessReport } from '../services/readiness.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    res.json(await computeReadinessReport(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/roles/:slug', async (req, res, next) => {
  try {
    const report = await computeReadinessReport(req.user.id);
    const match = report.roles.find(
      (r) => r.roleSlug === req.params.slug || r.roleId === req.params.slug,
    );
    if (!match) throw new AppError('Role not in your targets', 404);
    res.json(match);
  } catch (err) {
    next(err);
  }
});

export default router;