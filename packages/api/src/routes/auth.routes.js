import { Router } from 'express';
import { RegisterInputSchema, LoginInputSchema } from '@career/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import {
  registerUser,
  authenticate,
  signAccessToken,
  publicUser,
  expiresInSeconds,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
} from '../services/auth.service.js';

const router = Router();

router.post(
  '/register',
  validate(RegisterInputSchema),
  async (req, res, next) => {
    try {
      const user = await registerUser(req.body);
      const tokens = {
        accessToken: signAccessToken(user),
        tokenType: 'Bearer',
        expiresInSeconds: expiresInSeconds(),
      };
      res.status(201).json({ user: publicUser(user), tokens });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/login', validate(LoginInputSchema), async (req, res, next) => {
  try {
    const user = await authenticate(req.body);
    const tokens = {
      accessToken: signAccessToken(user),
      tokenType: 'Bearer',
      expiresInSeconds: expiresInSeconds(),
    };
    res.status(200).json({ user: publicUser(user), tokens });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
  });
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    await requestPasswordReset(email ?? '');
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/reset-password',
  validate(z.object({ token: z.string().min(1), password: z.string().min(8) })),
  async (req, res, next) => {
    try {
      await resetPassword(req.body);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body ?? {};
    if (!token) throw new AppError('Token is required', 422);
    await verifyEmail({ token });
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    await requestEmailVerification(req.body?.email ?? '');
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;