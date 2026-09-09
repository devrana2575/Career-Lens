import { AppError } from '../utils/errors.js';
import { verifyAccessToken } from '../services/auth.service.js';
import { User } from '../models/user.model.js';

/**
 * Express middleware. Requires a valid `Authorization: Bearer <token>` header
 * and attaches the authenticated user to `req.user`.
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = header.slice('Bearer '.length);
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) {
      throw new AppError('Account not found or disabled', 401);
    }

    req.user = { id: user._id.toString(), role: user.role, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts the route to specific user roles. Must follow requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    return next();
  };
}