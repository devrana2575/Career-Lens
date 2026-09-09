import { Assessment } from '../models/assessment.model.js';
import { AssessmentQuestion } from '../models/assessmentQuestion.model.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.model.js';
import { Skill } from '../models/skill.model.js';
import { Role } from '../models/role.model.js';
import { AppError } from '../utils/errors.js';
import { addEvidenceSource } from './evidence.service.js';
import * as executionClient from './execution.client.js';

/**
 * Types graded deterministically in this phase: mcq in-process, sql/coding via
 * the sandboxed execution seam in the data service.
 */
const AUTO_GRADED_TYPES = ['mcq', 'sql', 'coding'];

/** Maps an assessment type to the evidence source type its attempts become. */
const EVIDENCE_SOURCE_TYPE = {
  mcq: 'technical_assessment',
  coding: 'coding_assessment',
  sql: 'sql_assessment',
  dsa: 'dsa_practice',
  debugging: 'practical_task',
  practical: 'practical_task',
  case_study: 'project',
  written: 'written_assessment',
  project: 'project',
};

export async function listAssessments() {
  const assessments = await Assessment.find({ isActive: true }).sort({ title: 1 }).lean();
  if (assessments.length === 0) return { assessments: [] };

  const skillIds = [...new Set(assessments.map((a) => a.skillId))];
  const roleIds = [...new Set(assessments.map((a) => a.roleId).filter(Boolean))];
  const [skills, roles, counts] = await Promise.all([
    Skill.find({ _id: { $in: skillIds } }).lean(),
    Role.find({ _id: { $in: roleIds } }).lean(),
    AssessmentQuestion.aggregate([
      { $match: { assessmentId: { $in: assessments.map((a) => String(a._id)) } } },
      { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
    ]),
  ]);
  const skillMap = new Map(skills.map((s) => [String(s._id), s]));
  const roleMap = new Map(roles.map((r) => [String(r._id), r]));
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return {
    assessments: assessments.map((a) => ({
      id: String(a._id),
      title: a.title,
      description: a.description ?? null,
      type: a.type,
      skillId: a.skillId,
      skillName: skillMap.get(a.skillId)?.name ?? null,
      roleId: a.roleId ?? null,
      roleName: a.roleId ? (roleMap.get(a.roleId)?.name ?? null) : null,
      timeLimitMinutes: a.timeLimitMinutes,
      questionCount: countMap.get(String(a._id)) ?? 0,
    })),
  };
}

function toAttemptJson(attempt) {
  return {
    id: String(attempt._id),
    assessmentId: attempt.assessmentId,
    userId: attempt.userId,
    competencyId: attempt.competencyId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    answers: attempt.answers,
    totalScore: attempt.totalScore,
    maxScore: attempt.maxScore,
    percentScore: attempt.percentScore,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

/**
 * Starts an attempt. Returns the attempt plus its questions with the correct
 * answers stripped — the runner only sees prompts and options until scoring.
 */
export async function startAssessment(userId, assessmentId) {
  const assessment = await Assessment.findOne({ _id: assessmentId, isActive: true }).lean();
  if (!assessment) throw new AppError('Assessment not found', 404);
  if (!AUTO_GRADED_TYPES.includes(assessment.type)) {
    throw new AppError(`${assessment.type} assessments are not auto-graded yet`, 422);
  }

  const questions = await AssessmentQuestion.find({ assessmentId })
    .sort({ orderIndex: 1 })
    .lean();
  if (questions.length === 0) throw new AppError('This assessment has no questions yet', 422);

  const maxScore = questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
  const attempt = await AssessmentAttempt.create({
    userId,
    assessmentId,
    competencyId: null,
    status: 'in_progress',
    startedAt: new Date(),
    maxScore,
  });

  return {
    attempt: toAttemptJson(attempt),
    questions: questions.map((q) => ({
      id: String(q._id),
      type: q.type,
      prompt: q.prompt,
      options: q.options ?? [],
      difficulty: q.difficulty,
      points: q.points ?? 1,
      orderIndex: q.orderIndex,
    })),
  };
}

/**
 * Grades and finalizes an attempt, then writes it to the evidence graph as a
 * high-strength, timestamped source for the assessment's skill. Attempts are
 * immutable: a scored attempt can never be re-submitted.
 */
export async function submitAttempt(userId, attemptId, answers) {
  const attempt = await AssessmentAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) throw new AppError('Attempt not found', 404);
  if (attempt.status !== 'in_progress') throw new AppError('Attempt already submitted', 409);

  const assessment = await Assessment.findById(attempt.assessmentId).lean();
  if (!assessment) throw new AppError('Assessment no longer available', 404);

  const questions = await AssessmentQuestion.find({ assessmentId: attempt.assessmentId }).lean();
  const questionMap = new Map(questions.map((q) => [String(q._id), q]));

  const uniqueAnswers = [...new Map(answers.map((a) => [a.questionId, a])).values()];
  let awarded = 0;
  const graded = await Promise.all(
    uniqueAnswers.map(async (answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) return null;
      const points = question.points ?? 1;
      const verdict = await gradeAnswer(question, answer);
      awarded += verdict.earned;
      return {
        questionId: String(question._id),
        selectedOptionId: answer.selectedOptionId ?? null,
        text: answer.text ?? null,
        isCorrect: verdict.isCorrect,
        points: verdict.earned,
        maxPoints: points,
        details: verdict.details ?? null,
      };
    }),
  );
  const gradedNonNull = graded.filter(Boolean);

  const maxScore = questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
  attempt.answers = gradedNonNull;
  attempt.totalScore = awarded;
  attempt.maxScore = maxScore;
  attempt.percentScore = maxScore > 0 ? Math.round((awarded / maxScore) * 100) : 0;
  attempt.status = 'scored';
  attempt.submittedAt = new Date();
  await attempt.save();

  await addEvidenceSource(
    userId,
    assessment.skillId,
    {
      type: EVIDENCE_SOURCE_TYPE[assessment.type] ?? 'technical_assessment',
      strength: 'high',
      score: attempt.percentScore,
      referenceId: String(attempt._id),
      occurredAt: attempt.submittedAt.toISOString(),
      description: `${assessment.title} — scored ${attempt.percentScore}%`,
    },
    attempt.competencyId,
  );

  return getAttemptById(userId, String(attempt._id));
}

/** A single attempt with its questions. Correct answers only after scoring. */
export async function getAttemptById(userId, attemptId) {
  const attempt = await AssessmentAttempt.findOne({ _id: attemptId, userId }).lean();
  if (!attempt) return null;

  const [assessment, questions] = await Promise.all([
    Assessment.findById(attempt.assessmentId).lean(),
    AssessmentQuestion.find({ assessmentId: attempt.assessmentId }).sort({ orderIndex: 1 }).lean(),
  ]);
  const skill = assessment ? await Skill.findById(assessment.skillId).lean() : null;

  const scored = attempt.status !== 'in_progress';
  return {
    attempt: {
      id: String(attempt._id),
      assessmentId: attempt.assessmentId,
      assessmentTitle: assessment?.title ?? null,
      competencyId: attempt.competencyId ?? null,
      skillId: assessment?.skillId ?? null,
      skillName: skill?.name ?? null,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      percentScore: attempt.percentScore,
      answers: attempt.answers ?? [],
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    },
    questions: questions.map((q) => ({
      id: String(q._id),
      type: q.type,
      prompt: q.prompt,
      options: q.options ?? [],
      difficulty: q.difficulty,
      points: q.points ?? 1,
      orderIndex: q.orderIndex,
      ...(scored
        ? { correctOptionId: q.correctOptionId ?? null, explanation: q.explanation ?? null }
        : {}),
    })),
  };
}

/**
 * Grades a single answer according to its question type. mcq is graded
 * in-process; sql and coding delegate to the sandboxed execution seam and
 * return a bounded { earned, isCorrect, details } verdict. Unsupported types
 * score nothing — they are future rubric-graded modes.
 */
async function gradeAnswer(question, answer) {
  const points = question.points ?? 1;

  if (question.type === 'mcq') {
    const isCorrect =
      Boolean(question.correctOptionId) && answer.selectedOptionId === question.correctOptionId;
    return { earned: isCorrect ? points : 0, isCorrect, details: null };
  }

  if (question.type === 'sql') {
    if (!answer.text?.trim()) return { earned: 0, isCorrect: false, details: null };
    const result = await executionClient.executeSql({
      query: answer.text,
      schema: question.config?.schema,
      expected: question.config?.expected ?? null,
    });
    return {
      earned: result.passed ? points : 0,
      isCorrect: Boolean(result.passed),
      details: {
        rowCount: result.rowCount,
        expectedRowCount: result.expectedRowCount,
        trunc: result.truncated ?? false,
        durationMs: result.durationMs,
        error: result.error ?? null,
      },
    };
  }

  if (question.type === 'coding') {
    const cases = Array.isArray(question.config?.cases) ? question.config.cases : [];
    if (!answer.text?.trim() || cases.length === 0) {
      return { earned: 0, isCorrect: false, details: null };
    }
    const result = await executionClient.executeCode({
      language: question.config?.language ?? 'python',
      code: answer.text,
      cases,
    });
    const ratio = result.totalCases > 0 ? result.passedCases / result.totalCases : 0;
    const earned = Math.round(points * ratio);
    return {
      earned,
      isCorrect: earned > 0 && earned >= points,
      details: {
        totalCases: result.totalCases,
        passedCases: result.passedCases,
        durationMs: result.durationMs,
        results: result.results ?? [],
      },
    };
  }

  return { earned: 0, isCorrect: false, details: null };
}

export async function listMyAttempts(userId) {
  const attempts = await AssessmentAttempt.find({ userId }).sort({ updatedAt: -1 }).lean();
  if (attempts.length === 0) return { attempts: [] };

  const assessmentIds = [...new Set(attempts.map((a) => String(a.assessmentId)))];
  const assessments = await Assessment.find({ _id: { $in: assessmentIds } }).lean();
  const assessmentMap = new Map(assessments.map((a) => [String(a._id), a]));

  const skillIds = [...new Set(assessments.map((a) => a.skillId).filter(Boolean))];
  const skills = await Skill.find({ _id: { $in: skillIds } }).lean();
  const skillMap = new Map(skills.map((s) => [String(s._id), s]));

  return {
    attempts: attempts.map((a) => {
      const assessment = assessmentMap.get(String(a.assessmentId));
      return {
        id: String(a._id),
        assessmentId: String(a.assessmentId),
        assessmentTitle: assessment?.title ?? null,
        skillId: assessment?.skillId ?? null,
        skillName: skillMap.get(assessment?.skillId)?.name ?? null,
        type: assessment?.type ?? null,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        totalScore: a.totalScore,
        maxScore: a.maxScore,
        percentScore: a.percentScore,
      };
    }),
  };
}