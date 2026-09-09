import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import {
  getMarketOverview,
  listRoleBenchmarks,
  getRoleBenchmark,
  listSkillTrends,
  getSkillTrend,
} from '../services/market.service.js';

const router = Router();

router.get('/overview', async (_req, res, next) => {
  try {
    res.json(await getMarketOverview());
  } catch (err) {
    next(err);
  }
});

router.get('/benchmarks', async (_req, res, next) => {
  try {
    res.json(await listRoleBenchmarks());
  } catch (err) {
    next(err);
  }
});

router.get('/benchmarks/:roleId', async (req, res, next) => {
  try {
    const benchmark = await getRoleBenchmark(req.params.roleId);
    if (!benchmark) throw new AppError('Role not found', 404);
    res.json(benchmark);
  } catch (err) {
    next(err);
  }
});

router.get('/skills/trends', async (_req, res, next) => {
  try {
    res.json(await listSkillTrends());
  } catch (err) {
    next(err);
  }
});

router.get('/skills/:skillId/trend', async (req, res, next) => {
  try {
    const trend = await getSkillTrend(req.params.skillId);
    if (!trend) throw new AppError('Skill not found', 404);
    res.json(trend);
  } catch (err) {
    next(err);
  }
});

export default router;