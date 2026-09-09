import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { Profile } from '../models/profile.model.js';
import { AppError } from '../utils/errors.js';
import env from '../config/env.js';

const SALT_ROUNDS = 12;

/**
 * Registers a new user and creates their profile. Fails with 409 if the email
 * is already registered.
 */
export async function registerUser({ email, password, displayName, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    email,
    passwordHash,
    displayName,
    role: role ?? 'student',
  });

  await Profile.create({
    userId: user._id,
    profileType: user.role === 'recruiter' ? 'recruiter' : 'student',
  });

  return user;
}

/** Authenticates credentials and returns the user or throws 401. */
export async function authenticate({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError('Invalid email or password', 401);
  }

  return user;
}

/** Creates a signed access token for a user. */
export function signAccessToken(user) {
  const payload = { sub: user.id, role: user.role };
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/** Verifies a bearer token and returns the payload. Throws 401 if invalid. */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

export const publicUser = (user) => ({
  id: user.id ?? user._id.toString(),
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
});

export function expiresInSeconds() {
  const secondsPerUnit = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  const match = /^(\d+)([smhdw])$/.exec(env.jwtExpiresIn);
  if (!match) return 604800;
  return Number(match[1]) * (secondsPerUnit[match[2]] ?? 1);
}