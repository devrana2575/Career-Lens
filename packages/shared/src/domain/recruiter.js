import { z } from 'zod';

/**
 * Recruiter features — candidate browsing, comparison, shortlisting.
 */

export const CandidateSummarySchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string(),
  headline: z.string().nullable(),
  location: z.string().nullable(),
  targetRoles: z.array(z.object({ roleId: z.string(), roleName: z.string() })),
  readinessScore: z.number().min(0).max(100).nullable(),
  evidenceCount: z.number().int().min(0),
  topSkills: z.array(z.object({ skillName: z.string(), confidenceScore: z.number() })).max(5),
  githubUsername: z.string().nullable(),
});

export const CandidateDetailSchema = CandidateSummarySchema.extend({
  bio: z.string().nullable(),
  yearsOfExperience: z.number().nullable(),
  education: z.array(z.any()),
  readinessReports: z.array(z.any()),
  recentEvidence: z.array(z.any()).max(10),
});

export const CandidateComparisonSchema = z.object({
  candidates: z.array(CandidateDetailSchema),
});

export const ShortlistSchema = z.object({
  id: z.string(),
  recruiterId: z.string(),
  name: z.string(),
  candidateIds: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateShortlistInputSchema = z.object({
  name: z.string().min(1).max(200),
  candidateIds: z.array(z.string()).default([]),
});

export const UpdateShortlistInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  candidateIds: z.array(z.string()).optional(),
});
