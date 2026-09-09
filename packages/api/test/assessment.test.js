import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Assessment } from '../src/models/assessment.model.js';
import { AssessmentQuestion } from '../src/models/assessmentQuestion.model.js';
import { AppError } from '../src/utils/errors.js';

vi.mock('../src/services/execution.client.js', () => ({
  executeSql: vi.fn(),
  executeCode: vi.fn(),
}));
import * as executionClient from '../src/services/execution.client.js';

const app = createApp();
let token;
let otherToken;
let instanceCounter = 0;

async function makeUser(email, displayName = 'Assessment Tester', role = 'student') {
  const user = await registerUser({
    email,
    displayName,
    password: 'password123',
    role,
  });
  return signAccessToken(user);
}

async function seedMcqAssessment(overrides = {}) {
  const assessmentId = overrides.assessmentId ?? 'assess-test-python';
  await Assessment.findOneAndUpdate(
    { _id: assessmentId },
    {
      $setOnInsert: {
        title: 'Test Python Assessment',
        description: 'A tiny auto-graded MCQ set for tests.',
        type: 'mcq',
        skillId: 'skill-python',
        timeLimitMinutes: 10,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const questions = [
    {
      _id: 'assess-test-py-q1',
      assessmentId,
      skillId: 'skill-python',
      type: 'mcq',
      prompt: 'What is the result of 1 + 1?',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
      correctOptionId: 'a',
      explanation: '1 + 1 equals 2.',
      difficulty: 'beginner',
      points: 1,
      orderIndex: 0,
    },
    {
      _id: 'assess-test-py-q2',
      assessmentId,
      skillId: 'skill-python',
      type: 'mcq',
      prompt: 'Which type is immutable?',
      options: [
        { id: 'a', text: 'list' },
        { id: 'b', text: 'tuple' },
      ],
      correctOptionId: 'b',
      explanation: 'tuples are immutable.',
      difficulty: 'beginner',
      points: 1,
      orderIndex: 1,
    },
  ];
  await AssessmentQuestion.insertMany(questions);
  return { assessmentId, questions };
}

const SQL_SCHEMA = {
  tables: [
    {
      name: 'employees',
      columns: [
        { name: 'name', type: 'TEXT' },
        { name: 'dept', type: 'TEXT' },
      ],
      rows: [
        ['ada', 'Engineering'],
        ['grace', 'Engineering'],
        ['linus', 'Operations'],
      ],
    },
  ],
};

async function seedSqlAssessment() {
  const assessmentId = 'assess-test-sqlq';
  await Skill.findOneAndUpdate(
    { _id: 'skill-sql' },
    { $setOnInsert: { name: 'SQL', slug: 'sql', category: 'language', isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await Assessment.findOneAndUpdate(
    { _id: assessmentId },
    {
      $setOnInsert: {
        title: 'SQL Queries',
        type: 'sql',
        skillId: 'skill-sql',
        timeLimitMinutes: 10,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await AssessmentQuestion.create({
    _id: 'assess-test-sql-q1',
    assessmentId,
    skillId: 'skill-sql',
    type: 'sql',
    prompt: 'Return the names of Engineering employees, alphabetically.',
    correctOptionId: null,
    explanation: 'Filter on dept and order the results.',
    difficulty: 'intermediate',
    points: 2,
    orderIndex: 0,
    config: {
      schema: SQL_SCHEMA,
      expected: { columns: ['name'], rows: [['ada'], ['grace']] },
    },
  });
  return { assessmentId };
}

async function seedCodingAssessment() {
  const assessmentId = 'assess-test-code';
  await Assessment.findOneAndUpdate(
    { _id: assessmentId },
    {
      $setOnInsert: {
        title: 'Python Coding',
        type: 'coding',
        skillId: 'skill-python',
        timeLimitMinutes: 10,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await AssessmentQuestion.create({
    _id: 'assess-test-code-q1',
    assessmentId,
    skillId: 'skill-python',
    type: 'coding',
    prompt: 'Square an integer read from stdin and print the result.',
    correctOptionId: null,
    explanation: 'Read the input, compute n*n, print the result.',
    difficulty: 'beginner',
    points: 2,
    orderIndex: 0,
    config: {
      language: 'python',
      cases: [
        { input: '3\n', expectedOutput: '9\n' },
        { input: '-2\n', expectedOutput: '4\n' },
      ],
    },
  });
  return { assessmentId };
}

beforeEach(async () => {
  instanceCounter += 1;
  vi.mocked(executionClient.executeSql).mockReset();
  vi.mocked(executionClient.executeCode).mockReset();
  await Skill.findOneAndUpdate(
    { _id: 'skill-python' },
    { $setOnInsert: { name: 'Python', slug: 'python', category: 'language', isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  token = await makeUser(`assess+${instanceCounter}@example.com`);
  otherToken = await makeUser(`other-assess+${instanceCounter}@example.com`);
});

const RUBRIC_APPROACH = [
  {
    id: 'approach',
    label: 'Approach & structure',
    description: 'Correct design.',
    maxPoints: 2,
  },
  {
    id: 'correctness',
    label: 'Correctness',
    description: 'Edge cases handled.',
    maxPoints: 1,
  },
  {
    id: 'clarity',
    label: 'Communication',
    description: 'Clear explanation.',
    maxPoints: 1,
  },
];

const RUBRIC_DATA = [
  {
    id: 'approach',
    label: 'Methodology',
    description: 'Sound approach.',
    maxPoints: 2,
  },
  {
    id: 'accuracy',
    label: 'Query/logic accuracy',
    description: 'Correct logic.',
    maxPoints: 1,
  },
  {
    id: 'insight',
    label: 'Communicating insight',
    description: 'Leadership-ready framing.',
    maxPoints: 1,
  },
];

const CS_QUESTIONS = [
  {
    _id: 'assess-test-cs-q1',
    assessmentId: 'assess-test-case',
    skillId: 'skill-python',
    type: 'case_study',
    prompt: 'Explain how you would flatten a nested list in Python.',
    correctOptionId: null,
    explanation: 'Grade per rubric.',
    difficulty: 'intermediate',
    points: 4,
    orderIndex: 0,
    config: {},
    rubric: RUBRIC_APPROACH,
  },
  {
    _id: 'assess-test-cs-q2',
    assessmentId: 'assess-test-case',
    skillId: 'skill-python',
    type: 'case_study',
    prompt: 'How would you compute a 30-day churn rate?',
    correctOptionId: null,
    explanation: 'Grade per rubric.',
    difficulty: 'advanced',
    points: 4,
    orderIndex: 1,
    config: {},
    rubric: RUBRIC_DATA,
  },
];

async function seedCaseStudyAssessment() {
  await Assessment.findOneAndUpdate(
    { _id: 'assess-test-case' },
    {
      $setOnInsert: {
        title: 'Python Case Study',
        type: 'case_study',
        skillId: 'skill-python',
        timeLimitMinutes: 20,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await AssessmentQuestion.insertMany(
    CS_QUESTIONS.map((q) => ({ ...q, assessmentId: 'assess-test-case' })),
  );
  return { assessmentId: 'assess-test-case' };
}

async function submitCaseStudy(attemptId, personToken = token) {
  return request(app)
    .post(`/api/assessments/attempts/${attemptId}/submit`)
    .set('Authorization', `Bearer ${personToken}`)
    .send({
      answers: [
        { questionId: 'assess-test-cs-q1', text: 'recursion...' },
        { questionId: 'assess-test-cs-q2', text: 'cohort logic...' },
      ],
    });
}

function fullReview() {
  return {
    review: [
      {
        questionId: 'assess-test-cs-q1',
        scores: [
          { criterionId: 'approach', points: 1 },
          { criterionId: 'correctness', points: 1 },
          { criterionId: 'clarity', points: 1 },
        ],
        comment: 'Good structure, watch deep nesting.',
      },
      {
        questionId: 'assess-test-cs-q2',
        scores: [
          { criterionId: 'approach', points: 2 },
          { criterionId: 'accuracy', points: 0 },
          { criterionId: 'insight', points: 1 },
        ],
        comment: 'Sound methodology.',
      },
    ],
  };
}

describe('assessments API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/assessments');
    expect(res.status).toBe(401);
  });

  it('lists assessments with resolved skill names', async () => {
    await seedMcqAssessment();
    const res = await request(app).get('/api/assessments').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.assessments).toHaveLength(1);
    expect(res.body.assessments[0].skillName).toBe('Python');
    expect(res.body.assessments[0].questionCount).toBe(2);
  });

  it('only lists active assessments', async () => {
    await seedMcqAssessment();
    await Assessment.updateOne({ _id: 'assess-test-python' }, { $set: { isActive: false } });
    const res = await request(app).get('/api/assessments').set('Authorization', `Bearer ${token}`);
    expect(res.body.assessments).toHaveLength(0);
  });

  it('starts an attempt without leaking correct answers', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const res = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.attempt.status).toBe('in_progress');
    expect(res.body.questions).toHaveLength(2);
    for (const q of res.body.questions) {
      expect(q).not.toHaveProperty('correctOptionId');
      expect(q).not.toHaveProperty('explanation');
    }
  });

  it('returns 404 for an unknown assessment', async () => {
    const res = await request(app)
      .post('/api/assessments/assess-nope/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('scores an attempt and writes it to the evidence graph', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [
          { questionId: 'assess-test-py-q1', selectedOptionId: 'a' },
          { questionId: 'assess-test-py-q2', selectedOptionId: 'b' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.attempt.status).toBe('scored');
    expect(res.body.attempt.percentScore).toBe(100);
    expect(res.body.attempt.totalScore).toBe(2);
    expect(res.body.attempt.answers.every((a) => a.isCorrect)).toBe(true);

    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    const python = graph.body.skillAssessments.find((s) => s.skillId === 'skill-python');
    expect(python).toBeTruthy();
    expect(python.proficiencyScore).toBe(100);
    expect(python.sources[0]).toMatchObject({ type: 'technical_assessment', strength: 'high' });
  });

  it('awards points only for correct answers', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [
          { questionId: 'assess-test-py-q1', selectedOptionId: 'b' },
          { questionId: 'assess-test-py-q2', selectedOptionId: 'b' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.attempt.percentScore).toBe(50);
    expect(res.body.attempt.answers[0].isCorrect).toBe(false);
    expect(res.body.attempt.answers[0].points).toBe(0);
  });

  it('keeps attempts immutable: re-submission is rejected', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: 'assess-test-py-q1', selectedOptionId: 'a' }] });

    const again = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: 'assess-test-py-q2', selectedOptionId: 'b' }] });
    expect(again.status).toBe(409);
  });

  it('does not leak another user\'s attempt', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const hidden = await request(app)
      .get(`/api/assessments/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(hidden.status).toBe(404);

    const stolen = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ answers: [{ questionId: 'assess-test-py-q1', selectedOptionId: 'a' }] });
    expect(stolen.status).toBe(404);
  });

  it('reveals correct answers and explanations only after scoring', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: 'assess-test-py-q1', selectedOptionId: 'a' }] });

    const res = await request(app)
      .get(`/api/assessments/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.questions[0].correctOptionId).toBe('a');
    expect(res.body.questions[0].explanation).toBeTruthy();
    expect(res.body.attempt.percentScore).toBe(50);
  });

  it('rejects starting an assessment type that is not yet gradable', async () => {
    await Assessment.findOneAndUpdate(
      { _id: 'assess-test-debug' },
      {
        $setOnInsert: {
          title: 'Debugging Lab',
          type: 'debugging',
          skillId: 'skill-python',
          timeLimitMinutes: 10,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const res = await request(app)
      .post('/api/assessments/assess-test-debug/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });
});

describe('assessments API — sql/coding sandbox grading', () => {
  it('starts a sql assessment without leaking config or answers', async () => {
    const { assessmentId } = await seedSqlAssessment();
    const res = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0]).not.toHaveProperty('config');
    expect(res.body.questions[0]).not.toHaveProperty('correctOptionId');
    expect(res.body.questions[0]).not.toHaveProperty('explanation');
  });

  it('grades a correct sql answer through the sandbox seam', async () => {
    const { assessmentId } = await seedSqlAssessment();
    vi.mocked(executionClient.executeSql).mockResolvedValue({
      passed: true,
      rowCount: 2,
      expectedRowCount: 2,
      durationMs: 4,
    });
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [{ questionId: 'assess-test-sql-q1', text: 'SELECT name FROM employees' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.attempt.percentScore).toBe(100);
    expect(res.body.attempt.answers[0].details).toMatchObject({ rowCount: 2 });
    expect(executionClient.executeSql).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'SELECT name FROM employees' }),
    );

    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    const sql = graph.body.skillAssessments.find((s) => s.skillId === 'skill-sql');
    expect(sql.sources[0]).toMatchObject({ type: 'sql_assessment', strength: 'high' });
  });

  it('grades an incorrect sql answer and reports the diff', async () => {
    const { assessmentId } = await seedSqlAssessment();
    vi.mocked(executionClient.executeSql).mockResolvedValue({
      passed: false,
      rowCount: 3,
      expectedRowCount: 2,
      durationMs: 3,
    });
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [{ questionId: 'assess-test-sql-q1', text: 'SELECT name FROM employees' }],
      });

    expect(res.body.attempt.percentScore).toBe(0);
    expect(res.body.attempt.answers[0].isCorrect).toBe(false);
    expect(res.body.attempt.answers[0].details.expectedRowCount).toBe(2);
  });

  it('awards proportional points when a coding answer passes some cases', async () => {
    const { assessmentId } = await seedCodingAssessment();
    vi.mocked(executionClient.executeCode).mockResolvedValue({
      passed: false,
      totalCases: 2,
      passedCases: 1,
      durationMs: 12,
      results: [
        { case: 1, pass: true },
        { case: 2, pass: false },
      ],
    });
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [{ questionId: 'assess-test-code-q1', text: 'print(int(input())**2)' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.attempt.totalScore).toBe(1); // 2 points * 1/2 cases
    expect(res.body.attempt.percentScore).toBe(50);
    expect(res.body.attempt.answers[0].details.passedCases).toBe(1);
    expect(executionClient.executeCode).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'python', cases: expect.any(Array) }),
    );
  });

  it('surfaces a 502 when the execution service is unavailable', async () => {
    const { assessmentId } = await seedSqlAssessment();
    vi.mocked(executionClient.executeSql).mockRejectedValue(
      new AppError('Execution service unavailable', 502),
    );
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [{ questionId: 'assess-test-sql-q1', text: 'SELECT name FROM employees' }],
      });
    expect(res.status).toBe(502);
  });
});

describe('assessments API — rubric-graded case studies', () => {
  it('starts a case study with the rubric visible but no answers', async () => {
    const { assessmentId } = await seedCaseStudyAssessment();
    const res = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0].rubric).toEqual(RUBRIC_APPROACH);
    expect(res.body.questions[0]).not.toHaveProperty('config');
    expect(res.body.questions[0]).not.toHaveProperty('correctOptionId');
  });

  it('submitting moves to pending_review and writes no evidence yet', async () => {
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;

    const res = await submitCaseStudy(attemptId);
    expect(res.status).toBe(200);
    expect(res.body.attempt.status).toBe('pending_review');
    expect(res.body.attempt.percentScore).toBeNull();
    expect(res.body.attempt.answers.every((a) => a.isCorrect === null)).toBe(true);

    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    expect(graph.body.skillAssessments).toHaveLength(0);
  });

  it('lists pending attempts for a reviewer with the submission and rubric', async () => {
    const mentorToken = await makeUser('mentor-review@example.com', 'Mentor', 'mentor');
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    await submitCaseStudy(started.body.attempt.id);

    const res = await request(app)
      .get('/api/assessments/attempts/pending')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempts).toHaveLength(1);
    const item = res.body.attempts[0];
    expect(item.student.displayName).toBe('Assessment Tester');
    expect(item.questions[0].rubric).toEqual(RUBRIC_APPROACH);
    expect(item.questions[0].submission.text).toBe('recursion...');
  });

  it('blocks students and recruiters from reviewing', async () => {
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;
    await submitCaseStudy(attemptId);

    const asStudent = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send(fullReview());
    expect(asStudent.status).toBe(403);

    const asOther = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send(fullReview());
    expect(asOther.status).toBe(403);

    const recruiterToken = await makeUser('recruiter@example.com', 'Recruiter', 'recruiter');
    const asRecruiter = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send(fullReview());
    expect(asRecruiter.status).toBe(403);
  });

  it('scores the attempt from a mentor review and writes reviewed evidence', async () => {
    const mentorToken = await makeUser('mentor-score@example.com', 'Mentor', 'mentor');
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;
    await submitCaseStudy(attemptId);

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(fullReview());
    expect(res.status).toBe(200);
    expect(res.body.attempt.status).toBe('scored');
    expect(res.body.attempt.percentScore).toBe(75); // 3+3 of 4+4
    expect(res.body.attempt.totalScore).toBe(6);
    expect(res.body.attempt.reviewedBy).toBeTruthy();
    expect(res.body.attempt.answers[0].details.reviewComment).toBe(
      'Good structure, watch deep nesting.',
    );

    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    const python = graph.body.skillAssessments.find((s) => s.skillId === 'skill-python');
    expect(python.sources[0]).toMatchObject({
      type: 'project',
      strength: 'high',
      score: 75,
    });
  });

  it('rejects criterion scores above a rubric max', async () => {
    const mentorToken = await makeUser('mentor-bounds@example.com', 'Mentor', 'mentor');
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;
    await submitCaseStudy(attemptId);

    const review = fullReview();
    review.review[0].scores[0].points = 3; // approach max is 2
    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(review);
    expect(res.status).toBe(400);
  });

  it('rejects a review that misses one of the rubric questions', async () => {
    const mentorToken = await makeUser('mentor-partial@example.com', 'Mentor', 'mentor');
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;
    await submitCaseStudy(attemptId);

    const review = fullReview();
    review.review = review.review.slice(0, 1);
    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(review);
    expect(res.status).toBe(400);
  });

  it('keeps reviewed attempts immutable: re-review rejected', async () => {
    const mentorToken = await makeUser('mentor-immutable@example.com', 'Mentor', 'mentor');
    const { assessmentId } = await seedCaseStudyAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;
    await submitCaseStudy(attemptId);

    await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(fullReview());

    const again = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(fullReview());
    expect(again.status).toBe(409);
  });

  it('refuses to review an auto-graded attempt as if it were rubric-graded', async () => {
    const mentorToken = await makeUser('mentor-wrong@example.com', 'Mentor', 'mentor');
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`);
    const attemptId = started.body.attempt.id;
    await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: 'assess-test-py-q1', selectedOptionId: 'a' }] });

    const res = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(fullReview());
    expect(res.status).toBe(409); // authored attempt is already scored, not awaiting review
  });
});