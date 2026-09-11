import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateRoadmaps,
  listRoadmaps,
  toggleTask,
  deleteRoadmap,
} from '../services/roadmap.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    res.json(await listRoadmaps(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    res.json(await generateRoadmaps(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/tasks/:taskId', async (req, res, next) => {
  try {
    res.json(await toggleTask(req.user.id, req.params.id, req.params.taskId));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteRoadmap(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;