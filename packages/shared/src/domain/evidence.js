import { z } from 'zod';

/**
 * Evidence system.
 *
 * Proficiency and confidence-in-proficiency are separate concepts. Every
 * meaningful estimate must be traceable to evidence of one (or more) of the
 * source types below. Self-reported claims are a low-confidence source.
 */

export const EVIDENCE_TYPES = [
  'technical_assessment',
  'coding_assessment',
  'sql_assessment',
  'practical_task',
  'dsa_practice',
  'github',
  'project',
  'deployed_application',
  'resume',
  'certification',
  'internship',
  'experience',
  'portfolio',
  'written_assessment',
  'communication_assessment',
  'interview_simulation',
  'self_reported',
];

export const EvidenceTypeSchema = z.enum(EVIDENCE_TYPES);

/** Relative trustworthiness of an individual evidence item. */
export const EVIDENCE_STRENGTH_SCHEMA = z.enum(['low', 'medium', 'high']);

export const EvidenceStatusSchema = z.enum(['pending', 'verified', 'rejected']);

export const EvidenceSourceSchema = z.object({
  type: EvidenceTypeSchema,
  /** Relative trustworthiness of this individual evidence item. */
  strength: EVIDENCE_STRENGTH_SCHEMA.default('low'),
  /** Reference into the owning collection (assessmentAttempt, project, ...). */
  referenceId: z.string().optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  /** Discrete data (e.g. score) that backs this evidence item. */
  score: z.number().min(0).max(100).optional().nullable(),
  occurredAt: z.iso.datetime().optional().nullable(),
});

/**
 * A single piece of evidence linking a skill to one or more sources.
 * Aggregate per-skill with feedback loop into readiness engine.
 */
export const EvidenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  skillId: z.string(),
  competencyId: z.string().optional().nullable(),
  sources: z.array(EvidenceSourceSchema).default([]),
  proficiencyScore: z.number().min(0).max(100).optional().nullable(),
  confidenceScore: z.number().min(0).max(100).default(0),
  lastEvaluatedAt: z.iso.datetime().optional().nullable(),
  createdAt: z.iso.datetime().default(() => new Date().toISOString()),
  updatedAt: z.iso.datetime().default(() => new Date().toISOString()),
});

export const SkillAssessmentSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  proficiencyScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  sources: z.array(EvidenceSourceSchema),
});

export const EvidenceGraphSchema = z.object({
  skillAssessments: z.array(SkillAssessmentSchema),
  lastUpdatedAt: z.iso.datetime().optional().nullable(),
});

const EvidenceSourceInputSchema = EvidenceSourceSchema.partial().omit({
  type: true,
});

export const CreateEvidenceInputSchema = z.object({
  skillId: z.string().min(1).max(200),
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('technical_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('coding_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('sql_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('practical_task') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('dsa_practice') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('github') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('project') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('deployed_application') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('resume') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('certification') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('internship') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('experience') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('portfolio') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('written_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('communication_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('interview_simulation') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('self_reported') }).merge(EvidenceSourceInputSchema),
  ]),
});

export const AddEvidenceSourceInputSchema = z.object({
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('technical_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('coding_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('sql_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('practical_task') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('dsa_practice') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('github') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('project') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('deployed_application') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('resume') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('certification') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('internship') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('experience') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('portfolio') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('written_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('communication_assessment') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('interview_simulation') }).merge(EvidenceSourceInputSchema),
    z.object({ type: z.literal('self_reported') }).merge(EvidenceSourceInputSchema),
  ]),
});