import { z } from 'zod';

/**
 * Market intelligence read contracts (Phase 8).
 *
 * These describe the aggregate views served to students: role benchmarks,
 * skill demand trends and the global overview. Aggregates are computed from
 * append-only `marketSnapshots` and always carry an explicit data volume and
 * confidence so the "insufficient data" case is surfaced honestly.
 */

const DemandLabelSchema = z.enum(['rising', 'stable', 'declining', 'insufficient']);

export const SkillFrequencySchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  count: z.number().int().nonnegative(),
  share: z.number().min(0).max(1),
});

export const ExperienceYearsSchema = z.object({
  min: z.number().nullable(),
  avg: z.number().nullable(),
  max: z.number().nullable(),
});

export const LocationDemandSchema = z.object({
  location: z.string(),
  jobCount: z.number().int().nonnegative(),
});

export const RoleBenchmarkSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  roleSlug: z.string(),
  snapshotDate: z.string(),
  jobVolume: z.number().int().nonnegative(),
  dataVolume: z.string(),
  confidence: z.enum(['sufficient', 'insufficient']),
  demand: DemandLabelSchema,
  experienceYears: ExperienceYearsSchema,
  topSkills: z.array(SkillFrequencySchema),
  locations: z.array(LocationDemandSchema),
});

export const SkillTrendSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  trend: DemandLabelSchema,
  latestShare: z.number().min(0).max(1).nullable(),
  dataVolume: z.string(),
  confidence: z.enum(['sufficient', 'insufficient']),
  series: z.array(
    z.object({
      snapshotDate: z.string(),
      mentions: z.number().int().nonnegative(),
      jobs: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
    }),
  ),
});

export const MarketOverviewSchema = z.object({
  demoData: z.boolean(),
  asOfDate: z.string(),
  sources: z.array(z.string()),
  totalSnapshots: z.number().int().nonnegative(),
  totalJobs: z.number().int().nonnegative(),
  rolesCovered: z.number().int().nonnegative(),
  locations: z.array(z.string()),
});