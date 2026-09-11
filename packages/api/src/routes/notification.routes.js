import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
} from '../services/notification.service.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

function parseLimit(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(n, 100)) : 50;
}

router.get('/', async (req, res, next) => {
  try {
    const result = await listNotifications(req.user.id, parseLimit(req.query.limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    res.json({ unreadCount: await getUnreadCount(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const updated = await markAllRead(req.user.id);
    res.json({ updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    const notification = await markOneRead(req.user.id, req.params.id);
    if (!notification) throw new AppError('Notification not found', 404);
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

export default router;