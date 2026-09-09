import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import roleRoutes from './role.routes.js';
import evidenceRoutes from './evidence.routes.js';
import skillRoutes from './skill.routes.js';
import readinessRoutes from './readiness.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes);
router.use('/roles', roleRoutes);
router.use('/skills', skillRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/readiness', readinessRoutes);

export default router;