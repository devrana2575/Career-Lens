import { z } from 'zod';

/**
 * GitHub analysis results.
 *
 * Strength reflects how prominently a skill is evidenced across public repos
 * (based on repo count), not validated proficiency. Supporting evidence only.
 */

export const GitHubRepoSchema = z.object({
  name: z.string(),
  url: z.string(),
  stars: z.number().int().min(0),
  description: z.string().nullable(),
  languages: z.array(z.string()),
  topics: z.array(z.string()),
});

export const GitHubMatchedSkillSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  strength: z.enum(['low', 'medium', 'high']),
  repoCount: z.number().int().min(0),
  topRepos: z.array(GitHubRepoSchema).max(5),
});

export const GitHubStatsSchema = z.object({
  publicRepos: z.number().int().min(0),
  totalStars: z.number().int().min(0),
  topLanguages: z.array(z.string()),
  activityLevel: z.enum(['low', 'medium', 'high']),
});

export const GitHubAnalysisResultSchema = z.object({
  username: z.string(),
  matchedSkills: z.array(GitHubMatchedSkillSchema),
  stats: GitHubStatsSchema,
  note: z.string().nullable().optional(),
});

export const AnalyzeGitHubInputSchema = z.object({
  username: z.string().min(1).max(100),
});
