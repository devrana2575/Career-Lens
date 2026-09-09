import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { listRolesWithDetails, getRoleWithDetails } from '../services/role.service.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listRolesWithDetails());
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const role = await getRoleWithDetails(req.params.slug);
    if (!role) throw new AppError('Role not found', 404);
    res.json(role);
  } catch (err) {
    next(err);
  }
});

export default router;