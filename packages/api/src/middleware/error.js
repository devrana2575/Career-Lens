import { toAppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/** 404 handler for unmatched routes. */
export function notFoundHandler(_req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
}

/** Centralized error handler. Converts any error into a consistent response. */
export function errorHandler(err, _req, res, _next) {
  const appErr = toAppError(err);

  if (appErr.statusCode >= 500) {
    logger.error({ err: appErr }, 'Unhandled error');
  }

  const body = {
    error: {
      code: appErr.statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: appErr.message,
    },
  };
  if (appErr.details) body.error.details = appErr.details;

  res.status(appErr.statusCode).json(body);
}