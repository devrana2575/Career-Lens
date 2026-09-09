import { z } from 'zod';

const GapItemSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  baselineLevel: z.enum(['critical', 'required', 'preferred', 'optional']),
  weight: z.number(),
  proficiency: z.number().min(0).max(100).nullable(),
  evidenceQuality: z.enum(['validated', 'partial', 'self_reported', 'none']),
  missingEvidence: z.boolean(),
});

const RoadmapItemSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  action: z.string(),
  reason: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  effortEstimate: z.string().nullable(),
});

const ReadinessDimensionsSchema = z.object({
  technical: z.number().min(0).max(100).nullable(),
  professional: z.number().min(0).max(100).nullable(),
  marketAlignment: z.number().min(0).max(100).nullable(),
  evidenceConfidence: z.number().min(0).max(100).nullable(),
});

export const RoleReadinessSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  roleSlug: z.string(),
  overall: z.number().min(0).max(100).nullable(),
  dimensions: ReadinessDimensionsSchema,
  strengths: z.array(GapItemSchema),
  criticalGaps: z.array(GapItemSchema),
  mediumGaps: z.array(GapItemSchema),
  optionalGaps: z.array(GapItemSchema),
  missingEvidence: z.array(GapItemSchema),
  roadmap: z.array(RoadmapItemSchema),
  nextBestAction: RoadmapItemSchema.nullable(),
});

export const ReadinessReportSchema = z.object({
  roles: z.array(RoleReadinessSchema),
  explanation: z.string(),
  lastUpdatedAt: z.iso.datetime().nullable(),
});