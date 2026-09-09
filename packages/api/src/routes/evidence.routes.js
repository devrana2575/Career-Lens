import { Router } from 'express';
import { CreateEvidenceInputSchema, AddEvidenceSourceInputSchema } from '@career/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  addEvidenceSource,
  getEvidenceGraph,
  listMyEvidence,
  getEvidenceById,
  deleteEvidence,
} from '../services/evidence.service.js';

const router = Router();

router.use(requireAuth);

router.get('/graph', async (req, res, next) => {
  try {
    res.json(await getEvidenceGraph(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json({ records: await listMyEvidence(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(CreateEvidenceInputSchema), async (req, res, next) => {
  try {
    const evidence = await addEvidenceSource(
      req.user.id,
      req.body.skillId,
      req.body.source,
      req.body.competencyId,
    );
    res.status(201).json({ evidence });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/sources', validate(AddEvidenceSourceInputSchema), async (req, res, next) => {
  try {
    const existing = await getEvidenceById(req.user.id, req.params.id);
    if (!existing) throw new AppError('Evidence not found', 404);
    const evidence = await addEvidenceSource(
      req.user.id,
      existing.skillId,
      req.body.source,
      existing.competencyId,
    );
    res.json({ evidence });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const removed = await deleteEvidence(req.user.id, req.params.id);
    if (!removed) throw new AppError('Evidence not found', 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;