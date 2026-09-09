import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import logger from './utils/logger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: false,
    }),
  );

  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      limit: env.rateLimitMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, 'request');
    next();
  });

  app.use('/api', routes);
  app.use('/api', notFoundHandler);

  app.use(errorHandler);

  return app;
}