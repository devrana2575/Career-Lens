import { Router } from 'express';
import { RegisterInputSchema, LoginInputSchema } from '@career/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  registerUser,
  authenticate,
  signAccessToken,
  publicUser,
  expiresInSeconds,
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

export default router;