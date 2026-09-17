import { z } from 'zod';

export const MatchJobsInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(50_000)
    .refine((value) => value.trim().length > 0, {
      message: 'Resume text is required',
    }),
  jobIds: z.array(z.string().min(1)).max(100).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const SkillReferenceSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  category: z.string().nullable(),
});

const MatchedSkillSchema = SkillReferenceSchema.extend({
  strength: z.enum(['high', 'medium', 'low']),
  mentions: z.number().int().nonnegative(),
});

const JobMatchSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  experienceYears: z.number().nullable(),
  postedAt: z.string().nullable(),
  source: z.string().nullable(),
  fitScore: z.number().int().min(0).max(100),
  skillCoverage: z.number().int().min(0).max(100),
  textSimilarity: z.number().int().min(0).max(100),
  matchedSkills: z.array(MatchedSkillSchema),
  missingSkills: z.array(SkillReferenceSchema),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const JobMatchResponseSchema = z.object({
  matches: z.array(JobMatchSchema),
  candidate: z.object({
    skills: z.array(MatchedSkillSchema),
    detectedSkills: z.number().int().nonnegative(),
  }),
  summary: z.object({
    jobsEvaluated: z.number().int().nonnegative(),
    meanFit: z.number().int().min(0).max(100).nullable(),
    bestFit: z.number().int().min(0).max(100).nullable(),
    bestJob: z.object({ jobId: z.string(), title: z.string() }).nullable(),
  }),
  note: z.string(),
});