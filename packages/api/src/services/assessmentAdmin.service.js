import { randomUUID } from 'node:crypto';
import { Assessment } from '../models/assessment.model.js';
import { AssessmentQuestion } from '../models/assessmentQuestion.model.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.model.js';
import { Skill } from '../models/skill.model.js';
import { Role } from '../models/role.model.js';
import { AppError } from '../utils/errors.js';

function toAssessmentJson(assessment, extra = {}) {
  return {
    id: String(assessment._id),
    title: assessment.title,
    description: assessment.description ?? null,
    type: assessment.type,
    skillId: assessment.skillId,
    roleId: assessment.roleId ?? null,
    timeLimitMinutes: assessment.timeLimitMinutes ?? 10,
    isActive: Boolean(assessment.isActive),
    ...extra,
  };
}

function toQuestionJson(q) {
  return {
    id: String(q._id),
    assessmentId: q.assessmentId,
    skillId: q.skillId,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? [],
    correctOptionId: q.correctOptionId ?? null,
    explanation: q.explanation ?? null,
    difficulty: q.difficulty ?? 'intermediate',
    points: q.points ?? 1,
    orderIndex: q.orderIndex ?? 0,
    config: q.config ?? {},
    rubric: q.rubric ?? [],
  };
}

/**
 * Type-specific authoring rules. The shape of a question must match how the
 * grading engine consumes it so a saved assessment is always runnable.
 */
function validateTypeShape(type, question) {
  const options = question.options ?? [];
  if (type === 'mcq') {
    if (options.length < 2) {
      throw new AppError('MCQ questions require at least 2 options', 422, [
        { field: 'options', message: 'Provide at least two options' },
      ]);
    }
    if (!question.correctOptionId || !options.some((o) => o.id === question.correctOptionId)) {
      throw new AppError('MCQ questions require a correct option from the provided options', 422, [
        { field: 'correctOptionId', message: 'Must reference one of the options' },
      ]);
    }
  } else if (type === 'sql') {
    const schema = question.config?.schema;
    if (!schema || !Array.isArray(schema.tables) || schema.tables.length === 0) {
      throw new AppError('SQL questions require a schema with at least one table', 422, [
        { field: 'config.schema', message: 'Required for SQL questions' },
      ]);
    }
  } else if (type === 'coding') {
    const cases = question.config?.cases;
    if (!Array.isArray(cases) || cases.length === 0) {
      throw new AppError('Coding questions require at least one test case', 422, [
        { field: 'config.cases', message: 'Required for coding questions' },
      ]);
    }
  } else if (type === 'practical' || type === 'case_study') {
    const rubric = question.rubric ?? [];
    if (rubric.length === 0) {
      throw new AppError('Rubric-graded questions require at least one criterion', 422, [
        { field: 'rubric', message: 'Required for practical/case_study questions' },
      ]);
    }
  }
  return question;
}

/**
 * Keeps question types consistent with the assessment's grading mode.
 * Auto-graded assessments (mcq/sql/coding) must only hold auto-graded
 * questions; rubric-graded assessments (practical/case_study) only hold
 * rubric or future-human-graded question types.
 */
function assertQuestionTypeMatches(assessmentType, questionType) {
  const auto = ['mcq', 'sql', 'coding'];
  const rubric = ['practical', 'case_study'];
  const other = ['debugging', 'written', 'project'];
  let allowed;
  if (auto.includes(assessmentType)) allowed = auto;
  else if (rubric.includes(assessmentType)) allowed = [...rubric, ...other];
  else allowed = [...auto, ...rubric, ...other];

  if (!allowed.includes(questionType)) {
    throw new AppError(
      `Question type "${questionType}" is not compatible with a ${assessmentType} assessment`,
      422,
    );
  }
}

export async function listAssessmentBank() {
  const assessments = await Assessment.find().sort({ title: 1 }).lean();
  if (assessments.length === 0) return { assessments: [] };

  const counts = await AssessmentQuestion.aggregate([
    { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const skillIds = [...new Set(assessments.map((a) => a.skillId).filter(Boolean))];
  const roleIds = [...new Set(assessments.map((a) => a.roleId).filter(Boolean))];
  const [skills, roles] = await Promise.all([
    Skill.find({ _id: { $in: skillIds } }).lean(),
    Role.find({ _id: { $in: roleIds } }).lean(),
  ]);
  const skillMap = new Map(skills.map((s) => [String(s._id), s]));
  const roleMap = new Map(roles.map((r) => [String(r._id), r]));

  return {
    assessments: assessments.map((a) =>
      toAssessmentJson(a, {
        skillName: skillMap.get(String(a.skillId))?.name ?? null,
        roleName: a.roleId ? (roleMap.get(String(a.roleId))?.name ?? null) : null,
        questionCount: countMap.get(String(a._id)) ?? 0,
      }),
    ),
  };
}

export async function getAssessmentDefinition(assessmentId) {
  const assessment = await Assessment.findById(assessmentId).lean();
  if (!assessment) throw new AppError('Assessment not found', 404);

  const questions = await AssessmentQuestion.find({ assessmentId })
    .sort({ orderIndex: 1, createdAt: 1 })
    .lean();
  return { assessment: toAssessmentJson(assessment), questions: questions.map(toQuestionJson) };
}

export async function createAssessment(input) {
  const _id = input.id ?? `assess-${randomUUID()}`;
  const existing = await Assessment.findById(_id).lean();
  if (existing) throw new AppError('An assessment with this id already exists', 409);

  const assessment = new Assessment({
    _id,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    skillId: input.skillId,
    roleId: input.roleId ?? null,
    timeLimitMinutes: input.timeLimitMinutes ?? 10,
    isActive: input.isActive ?? true,
  });
  await assessment.save();
  return toAssessmentJson(assessment.toObject());
}

export async function updateAssessment(assessmentId, input) {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new AppError('Assessment not found', 404);

  if (input.type !== undefined && input.type !== assessment.type) {
    const existing = await AssessmentQuestion.find({ assessmentId }).select('type').lean();
    for (const question of existing) {
      assertQuestionTypeMatches(input.type, question.type);
    }
  }

  if (input.title !== undefined) assessment.title = input.title;
  if (input.description !== undefined) assessment.description = input.description;
  if (input.type !== undefined) assessment.type = input.type;
  if (input.skillId !== undefined) assessment.skillId = input.skillId;
  if (input.roleId !== undefined) assessment.roleId = input.roleId ?? null;
  if (input.timeLimitMinutes !== undefined) assessment.timeLimitMinutes = input.timeLimitMinutes;
  if (input.isActive !== undefined) assessment.isActive = input.isActive;
  await assessment.save();
  return toAssessmentJson(assessment.toObject());
}

export async function archiveAssessment(assessmentId) {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new AppError('Assessment not found', 404);
  assessment.isActive = false;
  await assessment.save();
  return toAssessmentJson(assessment.toObject());
}

export async function createQuestion(assessmentId, input) {
  const assessment = await Assessment.findById(assessmentId).lean();
  if (!assessment) throw new AppError('Assessment not found', 404);

  assertQuestionTypeMatches(assessment.type, input.type);
  const question = validateTypeShape(input.type, input);
  let orderIndex = question.orderIndex;
  if (orderIndex === undefined) {
    const last = await AssessmentQuestion.find({ assessmentId })
      .sort({ orderIndex: -1 })
      .limit(1)
      .lean();
    orderIndex = (last[0]?.orderIndex ?? -1) + 1;
  }

  const doc = new AssessmentQuestion({
    _id: `q-${randomUUID()}`,
    assessmentId,
    skillId: assessment.skillId,
    ...question,
    orderIndex,
  });
  await doc.save();
  return doc.toJSON();
}

export async function updateQuestion(questionId, input) {
  const question = await AssessmentQuestion.findById(questionId);
  if (!question) throw new AppError('Question not found', 404);

  const type = input.type ?? question.type;
  const assessment = await Assessment.findById(question.assessmentId).lean();
  if (!assessment) throw new AppError('Assessment not found', 404);
  assertQuestionTypeMatches(assessment.type, type);

  // Validate against the persisted fields plus only the fields explicitly
  // provided in the update (update schemas carry default values for arrays,
  // which must not clobber the stored question during validation).
  validateTypeShape(type, {
    type,
    prompt: input.prompt !== undefined ? input.prompt : question.prompt,
    options: input.options !== undefined ? input.options : question.options,
    correctOptionId:
      input.correctOptionId !== undefined
        ? input.correctOptionId
        : (question.correctOptionId ?? null),
    config: input.config !== undefined ? input.config : (question.config ?? {}),
    rubric: input.rubric !== undefined ? input.rubric : (question.rubric ?? []),
  });

  if (input.type !== undefined) question.type = input.type;
  if (input.prompt !== undefined) question.prompt = input.prompt;
  if (input.options !== undefined) question.options = input.options;
  if (input.correctOptionId !== undefined) question.correctOptionId = input.correctOptionId ?? null;
  if (input.explanation !== undefined) question.explanation = input.explanation ?? null;
  if (input.difficulty !== undefined) question.difficulty = input.difficulty;
  if (input.points !== undefined) question.points = input.points;
  if (input.orderIndex !== undefined) question.orderIndex = input.orderIndex;
  if (input.config !== undefined) question.config = input.config;
  if (input.rubric !== undefined) question.rubric = input.rubric;
  await question.save();
  return question.toJSON();
}

export async function deleteQuestion(questionId) {
  const question = await AssessmentQuestion.findById(questionId);
  if (!question) throw new AppError('Question not found', 404);

  const attemptCount = await AssessmentAttempt.countDocuments({
    'answers.questionId': String(question._id),
  });
  if (attemptCount > 0) {
    throw new AppError(
      'This question has been answered by submitted attempts and cannot be deleted',
      409,
    );
  }
  await AssessmentQuestion.deleteOne({ _id: questionId });
  return true;
}