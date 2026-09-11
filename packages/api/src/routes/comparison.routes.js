import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { compareRoles, validateCompareRoles } from '../services/comparison.service.js';

const router = Router();

router.use(requireAuth);

router.get('/roles', async (req, res, next) => {
  try {
    const roleIdsOrSlugs = validateCompareRoles(req.query.slugs);
    res.json(await compareRoles(req.user.id, roleIdsOrSlugs));
  } catch (err) {
    next(err);
  }
});

export default router;