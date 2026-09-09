import { z } from 'zod';

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];
export const GenderSchema = z.enum(GENDERS);

export const DEGREE_TYPES = ['btech', 'mtech', 'bsc', 'msc', 'bca', 'mca', 'other'];
export const DegreeTypeSchema = z.enum(DEGREE_TYPES);

export const EDUCATION_LEVELS = ['high_school', 'diploma', 'undergraduate', 'postgraduate'];
export const EducationLevelSchema = z.enum(EDUCATION_LEVELS);

export const EducationRecordSchema = z
  .object({
    institution: z.string().min(1).max(200),
    degreeType: DegreeTypeSchema.optional(),
    level: EducationLevelSchema,
    field: z.string().min(1).max(200),
    startYear: z.int().min(1950).max(2100),
    endYear: z.int().min(1950).max(2100).nullable().optional(),
    cgpa: z.number().min(0).max(10).nullable().optional(),
    isCurrent: z.boolean().default(false),
  })
  .partial()
  .refine((d) => !d.endYear || d.startYear <= d.endYear, {
    message: 'endYear must be after startYear',
    path: ['endYear'],
  });

/**
 * Student profile. Self-reported information is stored separately from
 * validated evidence so proficiency estimates are never driven primarily by
 * self-claims.
 */
export const StudentProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  headline: z.string().max(160).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  education: z.array(EducationRecordSchema).default([]),
  yearsOfExperience: z.int().min(0).max(50).default(0),
  githubUsername: z.string().max(120).optional().nullable(),
  portfolioUrl: z.url().optional().nullable(),
  linkedinUrl: z.url().optional().nullable(),
  selfReportedSkills: z
    .array(
      z.object({
        skillId: z.string(),
        claimedLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
      }),
    )
    .default([]),
  targetRoleIds: z.array(z.string()).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const RecruiterProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  company: z.string().min(1).max(160),
  title: z.string().min(1).max(160).optional().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const UpdateProfileInputSchema = StudentProfileSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const ProfileResponseSchema = z.union([StudentProfileSchema, RecruiterProfileSchema]);