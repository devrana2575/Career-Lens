import { z } from 'zod';

/**
 * Assessment engine.
 *
 * Question sets and scoring rules are data, not code. Each scored attempt
 * becomes an immutable piece of evidence for the assessment's skill, so
 * readiness estimates are never based on self-reported claims alone.
 *
 * `mcq` answers are graded in-process. `sql` and `coding` answers are shipped
 * to the replaceable execution seam (the data-service sandbox) — student code
 * and queries are never executed inside the API server. `practical` and
 * `case_study` submissions move to a `pending_review` state and are scored by
 * a human reviewer (admin/mentor) against the question's rubric; the score is
 * only written as evidence once reviewed. Debugging/written/project modes are
 * future rubric-graded modes.
 */

export const ASSESSMENT_TYPES = [
  'mcq',
  'coding',
  'sql',
  'debugging',
  'practical',
  'case_study',
  'written',
  'project',
];

export const AssessmentTypeSchema = z.enum(ASSESSMENT_TYPES);

export const QuestionDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const AttemptStatusSchema = z.enum(['in_progress', 'pending_review', 'scored']);

export const QuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

/** A single scored criterion used by human reviewers for practical/case_study questions. */
export const RubricCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  maxPoints: z.number().min(0).default(1),
});

/** A question as stored in the question bank and as revealed after scoring. */
export const AssessmentQuestionSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  skillId: z.string(),
  type: AssessmentTypeSchema.default('mcq'),
  prompt: z.string(),
  options: z.array(QuestionOptionSchema).default([]),
  correctOptionId: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  difficulty: QuestionDifficultySchema.default('intermediate'),
  points: z.number().min(0).default(1),
  orderIndex: z.number().int().min(0).default(0),
  // Grading inputs for non-mcq questions: for `sql` the controlled schema +
  // expected rowset, for `coding` the stdin/stdout test cases. Never exposed
  // to the runner.
  config: z.record(z.unknown()).default({}),
  // Human-graded criteria shown to the student and used by reviewers.
  rubric: z.array(RubricCriterionSchema).default([]),
});

export const AssessmentDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  type: AssessmentTypeSchema,
  skillId: z.string(),
  roleId: z.string().nullable().optional(),
  timeLimitMinutes: z.number().int().min(1).default(10),
  isActive: z.boolean().default(true),
  questionCount: z.number().int().min(0).optional(),
});

/** What the runner sends when submitting an attempt. Immutable thereafter. */
export const AttemptAnswerInputSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string().optional().nullable(),
  text: z.string().optional().nullable(),
});

export const SubmitAttemptInputSchema = z.object({
  answers: z.array(AttemptAnswerInputSchema).min(1),
});

export const ReviewCriterionScoreSchema = z.object({
  criterionId: z.string(),
  points: z.number().min(0),
});

export const ReviewQuestionInputSchema = z.object({
  questionId: z.string(),
  scores: z.array(ReviewCriterionScoreSchema).min(1),
  comment: z.string().max(2000).optional().nullable(),
});

/** Reviewer payload: criterion scores for each rubric question. */
export const ReviewAttemptInputSchema = z.object({
  review: z.array(ReviewQuestionInputSchema).min(1),
});

/** Graded answer snapshot stored on the attempt. */
export const AttemptAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  isCorrect: z.boolean().nullable().optional(),
  points: z.number().min(0).default(0),
  maxPoints: z.number().min(0).default(0),
  // Execution details for sql/coding answers (sandbox result summary). Bounded.
  details: z.record(z.unknown()).nullable().optional(),
});

export const AssessmentAttemptSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  userId: z.string(),
  competencyId: z.string().nullable().optional(),
  status: AttemptStatusSchema,
  startedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable().optional(),
  answers: z.array(AttemptAnswerSchema).default([]),
  totalScore: z.number().min(0).default(0),
  maxScore: z.number().min(0).default(0),
  percentScore: z.number().min(0).max(100).nullable().optional(),
  createdAt: z.iso.datetime().default(() => new Date().toISOString()),
  updatedAt: z.iso.datetime().default(() => new Date().toISOString()),
});

/** A question as handed to the runner (answers stripped before submission). */
export const RunnerQuestionSchema = AssessmentQuestionSchema.omit({
  correctOptionId: true,
  explanation: true,
  config: true,
});