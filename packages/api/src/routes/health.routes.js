import { Router } from 'express';
import mongoose from 'mongoose';
import env from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(200).json({
    status: 'ok',
    service: 'career-api',
    appName: env.appName,
    db: dbState === 1 ? 'connected' : `unavailable (state ${dbState})`,
    timestamp: new Date().toISOString(),
  });
});

export default router;