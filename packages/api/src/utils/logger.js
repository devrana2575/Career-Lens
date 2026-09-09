import { pino } from 'pino';
import env from '../config/env.js';

const logger = pino({
  level: env.logLevel,
  base: { service: 'career-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;