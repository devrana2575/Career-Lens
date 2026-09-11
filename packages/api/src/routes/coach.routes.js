import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversations,
  getConversation,
  sendMessage,
  deleteConversation,
} from '../services/coach.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

const SendBody = z.object({
  conversationId: z.string().optional().nullable(),
  content: z.string().min(1).max(5000),
});

router.get('/conversations', async (req, res, next) => {
  try {
    res.json(await listConversations(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    res.json(await getConversation(req.user.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/conversations', async (req, res, next) => {
  try {
    const result = await sendMessage(req.user.id, { conversationId: null, content: '' });
    res.status(201).json({ id: result.conversationId });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const parsed = SendBody.safeParse({ ...req.body, conversationId: req.params.id });
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    res.json(await sendMessage(req.user.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

router.post('/messages', async (req, res, next) => {
  try {
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('Validation failed', 422, details);
    }
    res.json(await sendMessage(req.user.id, parsed.data));
  } catch (err) {
    next(err);
  }
});

router.delete('/conversations/:id', async (req, res, next) => {
  try {
    await deleteConversation(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
