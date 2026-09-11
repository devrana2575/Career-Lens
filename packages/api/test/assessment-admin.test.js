import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Assessment } from '../src/models/assessment.model.js';
import { AssessmentQuestion } from '../src/models/assessmentQuestion.model.js';
import { AssessmentAttempt } from '../src/models/assessmentAttempt.model.js';

const app = createApp();

let adminToken;
let mentorToken;
let studentToken;
let instanceCounter = 0;

async function makeUser(email, role) {
  const user = await registerUser({
    email,
    displayName: 'Bank Tester',
    password: 'password123',
    role,
  });
  return signAccessToken(user);
}

async function createAssessmentOnce(id = 'assess-bank-base', token = adminToken) {
  return request(app)
    .post('/api/assessment-bank')
    .set('Authorization', `Bearer ${token}`)
    .send({ id, title: `Bank ${id}`, type: 'mcq', skillId: 'skill-python', timeLimitMinutes: 10 })
    .expect(201);
}

beforeEach(async () => {
  instanceCounter += 1;
  await Skill.findOneAndUpdate(
    { _id: 'skill-python' },
    { $setOnInsert: { name: 'Python', slug: 'python', category: 'language', isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  adminToken = await makeUser(`bank-admin+${instanceCounter}@example.com`, 'admin');
  mentorToken = await makeUser(`bank-mentor+${instanceCounter}@example.com`, 'mentor');
  studentToken = await makeUser(`bank-student+${instanceCounter}@example.com`, 'student');
  await Assessment.deleteMany({ _id: { $regex: '^assess-bank-' } });
  await AssessmentQuestion.deleteMany({ assessmentId: { $regex: '^assess-bank-' } });
});

describe('assessment bank access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/assessment-bank');
    expect(res.status).toBe(401);
  });

  it('forbids students', async () => {
    const res = await request(app)
      .get('/api/assessment-bank')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admins and mentors', async () => {
    await createAssessmentOnce('assess-bank-access');
    const res = await request(app)
      .get('/api/assessment-bank')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(200);
  });
});

describe('assessment bank CRUD', () => {
  it('creates, lists, and reads back an assessment', async () => {
    const created = await request(app)
      .post('/api/assessment-bank')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id: 'assess-bank-py',
        title: 'Bank Python',
        type: 'mcq',
        skillId: 'skill-python',
        timeLimitMinutes: 15,
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 'assess-bank-py',
      title: 'Bank Python',
      type: 'mcq',
      skillId: 'skill-python',
      timeLimitMinutes: 15,
      isActive: true,
    });

    const list = await request(app)
      .get('/api/assessment-bank')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(list.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'assess-bank-py', skillName: 'Python', questionCount: 0 }),
      ]),
    );

    const get = await request(app)
      .get('/api/assessment-bank/assess-bank-py')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.assessment.title).toBe('Bank Python');
    expect(get.body.questions).toEqual([]);
  });

  it('rejects a duplicate assessment id', async () => {
    await createAssessmentOnce('assess-bank-dup');
    const res = await request(app)
      .post('/api/assessment-bank')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: 'assess-bank-dup', title: 'Duplicate', type: 'mcq', skillId: 'skill-python' });
    expect(res.status).toBe(409);
  });

  it('updates assessment fields including activation', async () => {
    await createAssessmentOnce('assess-bank-up');
    const updated = await request(app)
      .put('/api/assessment-bank/assess-bank-up')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Renamed Bank', isActive: false, timeLimitMinutes: 5 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ title: 'Renamed Bank', isActive: false, timeLimitMinutes: 5 });
  });

  it('archives an assessment via DELETE', async () => {
    await createAssessmentOnce('assess-bank-arch');
    const res = await request(app)
      .delete('/api/assessment-bank/assess-bank-arch')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const list = await request(app)
      .get('/api/assessment-bank')
      .set('Authorization', `Bearer ${adminToken}`);
    const item = list.body.assessments.find((a) => a.id === 'assess-bank-arch');
    expect(item.isActive).toBe(false);
  });

  it('returns 404 for a missing assessment', async () => {
    const res = await request(app)
      .get('/api/assessment-bank/assess-bank-missing')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('question authoring', () => {
  async function ensureAssessment(id, type) {
    return request(app)
      .post('/api/assessment-bank')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id, title: `Bank ${id}`, type, skillId: 'skill-python', timeLimitMinutes: 10 })
      .expect(201);
  }

  async function postQuestion(assessmentId, payload, token = adminToken) {
    return request(app)
      .post(`/api/assessment-bank/${assessmentId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
  }

  it('creates an MCQ question with a correct option and lists it', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const created = await postQuestion('assess-bank-q', {
      type: 'mcq',
      prompt: 'What is 1 + 1?',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
      correctOptionId: 'a',
      points: 1,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ type: 'mcq', correctOptionId: 'a' });
    expect(created.body.id).toBeTruthy();

    const def = await request(app)
      .get('/api/assessment-bank/assess-bank-q')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(def.body.questions).toHaveLength(1);
    expect(def.body.questions[0].correctOptionId).toBe('a');
  });

  it('rejects an MCQ question without a correct option', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const res = await postQuestion('assess-bank-q', {
      type: 'mcq',
      prompt: '1 + 1?',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
    });
    expect(res.status).toBe(422);
  });

  it('rejects an MCQ question with a single option', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const res = await postQuestion('assess-bank-q', {
      type: 'mcq',
      prompt: '1 + 1?',
      options: [{ id: 'a', text: '2' }],
      correctOptionId: 'a',
    });
    expect(res.status).toBe(422);
  });

  it('accepts a coding question with test cases and rejects one without', async () => {
    await ensureAssessment('assess-bank-code', 'coding');
    const ok = await postQuestion('assess-bank-code', {
      type: 'coding',
      prompt: 'Square an integer read from stdin and print it.',
      config: {
        language: 'python',
        cases: [{ input: '3\n', expectedOutput: '9\n' }],
      },
      points: 2,
    });
    expect(ok.status).toBe(201);

    const bad = await postQuestion('assess-bank-code', {
      type: 'coding',
      prompt: 'No cases here.',
      points: 2,
    });
    expect(bad.status).toBe(422);
  });

  it('accepts an SQL question with a schema and rejects one without', async () => {
    await ensureAssessment('assess-bank-sql', 'sql');
    const ok = await postQuestion('assess-bank-sql', {
      type: 'sql',
      prompt: 'Return all names.',
      config: {
        schema: {
          tables: [
            {
              name: 'employees',
              columns: [{ name: 'name', type: 'TEXT' }],
              rows: [['ada']],
            },
          ],
        },
        expected: { columns: ['name'], rows: [['ada']] },
      },
      points: 2,
    });
    expect(ok.status).toBe(201);

    const bad = await postQuestion('assess-bank-sql', {
      type: 'sql',
      prompt: 'No schema.',
      config: {},
      points: 2,
    });
    expect(bad.status).toBe(422);
  });

  it('accepts a case_study question with a rubric and rejects one without', async () => {
    await ensureAssessment('assess-bank-cs', 'case_study');
    const ok = await postQuestion('assess-bank-cs', {
      type: 'case_study',
      prompt: 'Explain how you would compute churn.',
      rubric: [{ id: 'approach', label: 'Approach', maxPoints: 4 }],
      points: 4,
    });
    expect(ok.status).toBe(201);

    const bad = await postQuestion('assess-bank-cs', {
      type: 'case_study',
      prompt: 'No rubric.',
      points: 4,
    });
    expect(bad.status).toBe(422);
  });

  it('rejects a question type incompatible with the assessment type', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const res = await postQuestion('assess-bank-q', {
      type: 'case_study',
      prompt: 'Rubric work inside an MCQ assessment.',
      rubric: [{ id: 'approach', label: 'Approach', maxPoints: 4 }],
    });
    expect(res.status).toBe(422);
  });

  it('updates a question', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const created = await postQuestion('assess-bank-q', {
      type: 'mcq',
      prompt: 'Before',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
      correctOptionId: 'a',
    });
    const updated = await request(app)
      .put(`/api/assessment-bank/questions/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prompt: 'After', points: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ prompt: 'After', points: 3, correctOptionId: 'a' });
  });

  it('re-validates the full question on update', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const created = await postQuestion('assess-bank-q', {
      type: 'mcq',
      prompt: 'Before',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
      correctOptionId: 'a',
    });
    const res = await request(app)
      .put(`/api/assessment-bank/questions/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ correctOptionId: 'missing' });
    expect(res.status).toBe(422);
  });

  it('deletes a question when no attempt references it, and blocks deletion once answered', async () => {
    await ensureAssessment('assess-bank-q', 'mcq');
    const created = await postQuestion('assess-bank-q', {
      type: 'mcq',
      prompt: '1 + 1?',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
      correctOptionId: 'a',
    });
    const questionId = created.body.id;

    await AssessmentAttempt.create({
      assessmentId: 'assess-bank-q',
      userId: 'test-student',
      status: 'scored',
      answers: [{ questionId, selectedOptionId: 'a', isCorrect: true, points: 1, maxPoints: 1 }],
      totalScore: 1,
      maxScore: 1,
      percentScore: 100,
    });

    const blocked = await request(app)
      .delete(`/api/assessment-bank/questions/${questionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(blocked.status).toBe(409);

    await AssessmentAttempt.deleteMany({ 'answers.questionId': questionId });

    const res = await request(app)
      .delete(`/api/assessment-bank/questions/${questionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const def = await request(app)
      .get('/api/assessment-bank/assess-bank-q')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(def.body.questions).toHaveLength(0);
  });
});