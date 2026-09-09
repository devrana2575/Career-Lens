import { z } from 'zod';

export const USER_ROLES = ['student', 'recruiter', 'admin'];
export const UserRoleSchema = z.enum(USER_ROLES);

/**
 * A platform account. Distinct from a Profile, which carries domain-specific
 * data for students and recruiters.
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.email().toLowerCase(),
  displayName: z.string().min(1).max(120),
  role: UserRoleSchema,
  avatarUrl: z.url().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Public representation of a user returned by the API. */
export const PublicUserSchema = UserSchema.pick({
  id: true,
  email: true,
  displayName: true,
  role: true,
  avatarUrl: true,
});

/** Registration payload. */
export const RegisterInputSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Name is required').max(120),
  role: UserRoleSchema.default('student'),
});

/** Login payload. */
export const LoginInputSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const AuthTokenSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresInSeconds: z.int().positive(),
});

export const LoginResponseSchema = z.object({
  user: PublicUserSchema,
  tokens: AuthTokenSchema,
});

export const AuthMeResponseSchema = PublicUserSchema;