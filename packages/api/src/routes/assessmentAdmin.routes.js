import { Router } from 'express';
import {
  CreateAssessmentInputSchema,
  UpdateAssessmentInputSchema,
  CreateQuestionInputSchema,
  UpdateQuestionInputSchema,
} from '@career/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listAssessmentBank,
  getAssessmentDefinition,
  createAssessment,
  updateAssessment,
  archiveAssessment,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../services/assessmentAdmin.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin', 'mentor'));

function parse(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError('Validation failed', 422, details);
  }
  return parsed.data;
}

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listAssessmentBank());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getAssessmentDefinition(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = parse(CreateAssessmentInputSchema, req.body);
    res.status(201).json(await createAssessment(input));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = parse(UpdateAssessmentInputSchema, req.body);
    res.json(await updateAssessment(req.params.id, input));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await archiveAssessment(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:assessmentId/questions', async (req, res, next) => {
  try {
    const input = parse(CreateQuestionInputSchema, req.body);
    res.status(201).json(await createQuestion(req.params.assessmentId, input));
  } catch (err) {
    next(err);
  }
});

router.put('/questions/:questionId', async (req, res, next) => {
  try {
    const input = parse(UpdateQuestionInputSchema, req.body);
    res.json(await updateQuestion(req.params.questionId, input));
  } catch (err) {
    next(err);
  }
});

router.delete('/questions/:questionId', async (req, res, next) => {
  try {
    await deleteQuestion(req.params.questionId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;