import { z } from 'zod';

/**
 * Skill ontology.
 *
 * Hierarchy: Role -> Competency -> Skill -> Subskill -> Technology/Tool
 * Stored entirely as data so new roles can be added without code changes.
 */

export const SkillSchema = z.object({
  id: z.string(),
  /** Canonical normalized name. Raw aliases map to this via skillAliases. */
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.enum(['language', 'framework', 'tool', 'concept', 'domain', 'soft']),
  parentId: z.string().nullable().optional(),
  children: z.array(z.string()).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Normalization rule: a raw spelling -> canonical skill name. */
export const SkillAliasSchema = z.object({
  id: z.string(),
  alias: z.string().min(1).max(100),
  skillId: z.string(),
  canonicalName: z.string().min(1).max(80),
  createdAt: z.iso.datetime(),
});

export const CompetencySchema = z.object({
  id: z.string(),
  /** e.g. "CS Fundamentals", "Backend Development", "Statistics" */
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  /** Skill ids that make up this competency. */
  skillIds: z.array(z.string()).default([]),
  roleId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  family: z.string().min(1).max(100),
  description: z.string().max(1500).optional().nullable(),
  /** Competency ids. */
  competencyIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const RoleRequirementsSourceSchema = z.enum(['curated', 'market', 'admin']);

export const RoleRequirementSchema = z.object({
  id: z.string(),
  roleId: z.string(),
  competencyId: z.string(),
  skillId: z.string(),
  /**
   * Baseline required level per curated definition. Configurable and updates
   * over time from market evidence. NOT an immutable universal truth.
   */
  baselineLevel: z.enum(['optional', 'preferred', 'required', 'critical']).default('required'),
  minYearsExperience: z.number().min(0).max(30).default(0),
  weight: z.number().min(0).max(1),
  source: RoleRequirementsSourceSchema.default('curated'),
  updatedAt: z.iso.datetime(),
});

export const RoleWithCompetenciesSchema = RoleSchema.extend({
  competencies: z.array(CompetencySchema),
});