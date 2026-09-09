export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Converts any thrown value into an AppError for consistent middleware handling. */
export function toAppError(err) {
  if (err instanceof AppError) return err;

  if (err && typeof err === 'object' && err.name === 'ValidationError') {
    return new AppError('Validation failed', 422, err.errors);
  }

  if (err && typeof err === 'object' && err.code === 11000) {
    const key = Object.keys(err.keyPattern ?? {})[0];
    return new AppError(`Duplicate value for ${key}`, 409);
  }

  if (err && typeof err === 'object' && err.name === 'CastError') {
    return new AppError('Invalid identifier', 400);
  }

  return new AppError(err?.message ?? 'Internal server error', 500);
}