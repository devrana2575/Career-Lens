import { AppError } from '../utils/errors.js';

/**
 * Express middleware factory. Validates an incoming body/query segment against
 * a Zod schema and replaces the segment with the (normalized) parsed value.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Validation failed', 422, details));
    }
    req[source] = result.data;
    return next();
  };
}