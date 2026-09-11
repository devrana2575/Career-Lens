import { z } from 'zod';

/**
 * Project module.
 *
 * Students add projects they have built. Projects produce `project` evidence
 * in the evidence graph — strength is based on completeness (has URL, skills, etc.).
 */

export const SkillUsedSchema = z.object({
  skillSlug: z.string().min(1).max(200),
  skillId: z.string().min(1).max(200),
  role: z.string().max(100).optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  url: z.string().url().max(2000).optional().nullable(),
  repoUrl: z.string().url().max(2000).optional().nullable(),
  techStack: z.array(z.string().max(100)).max(20).default([]),
  skillsUsed: z.array(SkillUsedSchema).default([]),
  startDate: z.iso.datetime().optional().nullable(),
  endDate: z.iso.datetime().optional().nullable(),
  isOngoing: z.boolean().default(false),
  createdAt: z.iso.datetime().default(() => new Date().toISOString()),
  updatedAt: z.iso.datetime().default(() => new Date().toISOString()),
});

export const CreateProjectInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  url: z.string().url().max(2000).optional().nullable(),
  repoUrl: z.string().url().max(2000).optional().nullable(),
  techStack: z.array(z.string().max(100)).max(20).default([]),
  skillsUsed: z.array(SkillUsedSchema).default([]),
  startDate: z.iso.datetime().optional().nullable(),
  endDate: z.iso.datetime().optional().nullable(),
  isOngoing: z.boolean().default(false),
});

export const UpdateProjectInputSchema = CreateProjectInputSchema.partial();
