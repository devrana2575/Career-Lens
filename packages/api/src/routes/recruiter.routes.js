import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listCandidates,
  getCandidateDetail,
  compareCandidates,
  createShortlist,
  listShortlists,
  getShortlist,
  updateShortlist,
  deleteShortlist,
} from '../services/recruiter.service.js';
import {
  listRecruiterApplications,
  updateApplicationByRecruiter,
} from '../services/application.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('recruiter', 'admin'));

// --- Candidates ---

router.get('/candidates', async (req, res, next) => {
  try {
    const { roleId, minReadiness, skill } = req.query;
    const candidates = await listCandidates(req.user.id, {
      roleId,
      minReadiness: minReadiness != null ? Number(minReadiness) : undefined,
      skillSearch: skill,
    });
    res.json(candidates);
  } catch (err) {
    next(err);
  }
});

router.get('/candidates/:id', async (req, res, next) => {
  try {
    res.json(await getCandidateDetail(req.params.id));
  } catch (err) {
    next(err);
  }
});

const CompareBody = z.object({
  candidateIds: z.array(z.string()).min(2).max(5),
});

router.post('/candidates/compare', async (req, res, next) => {
  try {
    const parsed = CompareBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    res.json(await compareCandidates(req.user.id, parsed.data.candidateIds));
  } catch (err) {
    next(err);
  }
});

// --- Applications for my jobs ---

router.get('/applications', async (req, res, next) => {
  try {
    res.json(await listRecruiterApplications(req.user.id));
  } catch (err) {
    next(err);
  }
});

const UpdateApplicationBody = z.object({
  status: z.enum(['applied', 'interviewing', 'offered', 'rejected', 'withdrawn']),
});

router.patch('/applications/:id', async (req, res, next) => {
  try {
    const parsed = UpdateApplicationBody.safeParse(req.body);
    if (!parsed.success) throw new AppError('Validation failed', 422, parsed.error.issues);
    res.json(await updateApplicationByRecruiter(req.user.id, req.params.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// --- Shortlists ---

router.get('/shortlists', async (req, res, next) => {
  try {
    res.json(await listShortlists(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/shortlists/:id', async (req, res, next) => {
  try {
    res.json(await getShortlist(req.user.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

const CreateShortlistBody = z.object({
  name: z.string().min(1).max(200),
  candidateIds: z.array(z.string()).default([]),
});

router.post('/shortlists', async (req, res, next) => {
  try {
    const parsed = CreateShortlistBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    const sl = await createShortlist(req.user.id, parsed.data);
    res.status(201).json(sl);
  } catch (err) {
    next(err);
  }
});

const UpdateShortlistBody = z.object({
  name: z.string().min(1).max(200).optional(),
  candidateIds: z.array(z.string()).optional(),
});

router.put('/shortlists/:id', async (req, res, next) => {
  try {
    const parsed = UpdateShortlistBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    res.json(await updateShortlist(req.user.id, req.params.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

router.delete('/shortlists/:id', async (req, res, next) => {
  try {
    await deleteShortlist(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
