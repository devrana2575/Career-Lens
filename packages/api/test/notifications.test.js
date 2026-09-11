import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Assessment } from '../src/models/assessment.model.js';
import { AssessmentQuestion } from '../src/models/assessmentQuestion.model.js';
import { Notification } from '../src/models/notification.model.js';

const app = createApp();

let studentToken;
let studentId;
let recruiterToken;
let otherToken;
let otherId;
let instanceCounter = 0;

async function makeUser(email, role = 'student') {
  const user = await registerUser({
    email,
    displayName: 'Notification Tester',
    password: 'password123',
    role,
  });
  return { token: signAccessToken(user), id: String(user.id) };
}

async function seedMcqAssessment() {
  const assessmentId = 'assess-notif-python';
  await Assessment.findOneAndUpdate(
    { _id: assessmentId },
    {
      $setOnInsert: {
        title: 'Notif Python Assessment',
        description: 'A tiny auto-graded MCQ set for notification tests.',
        type: 'mcq',
        skillId: 'skill-python',
        timeLimitMinutes: 10,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await AssessmentQuestion.insertMany([
    {
      _id: 'assess-notif-py-q1',
      assessmentId,
      skillId: 'skill-python',
      type: 'mcq',
      prompt: 'What is 1 + 1?',
      options: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
      ],
      correctOptionId: 'a',
      explanation: '1 + 1 is 2.',
      difficulty: 'beginner',
      points: 1,
      orderIndex: 0,
    },
  ]);
  return { assessmentId };
}

beforeEach(async () => {
  instanceCounter += 1;
  await Skill.findOneAndUpdate(
    { _id: 'skill-python' },
    { $setOnInsert: { name: 'Python', slug: 'python', category: 'language', isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const student = await makeUser(`notif-student+${instanceCounter}@example.com`);
  const recruiter = await makeUser(`notif-recruiter+${instanceCounter}@example.com`, 'recruiter');
  const other = await makeUser(`notif-other+${instanceCounter}@example.com`);
  studentId = student.id;
  studentToken = student.token;
  recruiterToken = recruiter.token;
  otherToken = other.token;
  otherId = other.id;
  await Notification.deleteMany({});
});

describe('notifications API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns an empty list and a zero unread count for a fresh user', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.unreadCount).toBe(0);
  });

  it('lists notifications newest first with the unread count', async () => {
    await Notification.create({
      userId: studentId,
      kind: 'shortlisted',
      title: 'You were added to a shortlist',
      message: 'A recruiter added you to the shortlist "Talent".',
      data: { shortlistId: 'sl-1', shortlistName: 'Talent' },
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await Notification.create({
      userId: studentId,
      kind: 'assessment_completed',
      title: 'Assessment completed: Notif Python Assessment',
      message: 'You scored 100% on Notif Python Assessment.',
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.notifications[0].kind).toBe('assessment_completed');
    expect(res.body.notifications[1].kind).toBe('shortlisted');
    expect(res.body.notifications[0]).toMatchObject({
      isRead: false,
      title: 'Assessment completed: Notif Python Assessment',
    });
    expect(res.body.notifications[0]).toHaveProperty('id');
    expect(res.body.notifications[0]).toHaveProperty('createdAt');
  });

  it('reports the unread count', async () => {
    await Notification.create({
      userId: studentId,
      kind: 'shortlisted',
      title: 'T',
      message: 'M',
    });
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);
  });

  it('marks a single notification as read', async () => {
    const created = await Notification.create({
      userId: studentId,
      kind: 'shortlisted',
      title: 'T',
      message: 'M',
    });
    const res = await request(app)
      .post(`/api/notifications/${created._id}/read`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notification).toMatchObject({ isRead: true });
    expect(res.body.notification.readAt).toBeTruthy();

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(list.body.unreadCount).toBe(0);
  });

  it('returns 404 when marking someone else\'s notification read', async () => {
    const created = await Notification.create({
      userId: studentId,
      kind: 'shortlisted',
      title: 'T',
      message: 'M',
    });
    const res = await request(app)
      .post(`/api/notifications/${created._id}/read`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('marks all notifications as read', async () => {
    await Notification.create({ userId: studentId, kind: 'shortlisted', title: 'T', message: 'M' });
    await Notification.create({
      userId: studentId,
      kind: 'assessment_completed',
      title: 'T2',
      message: 'M2',
    });
    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    const remaining = await Notification.countDocuments({ userId: studentId, isRead: false });
    expect(remaining).toBe(0);
  });
});

describe('notification generation', () => {
  it('creates an assessment_completed notification when an attempt is scored', async () => {
    const { assessmentId } = await seedMcqAssessment();
    const started = await request(app)
      .post(`/api/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(started.status).toBe(201);
    const attemptId = started.body.attempt.id;

    const submit = await request(app)
      .post(`/api/assessments/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: 'assess-notif-py-q1', selectedOptionId: 'a' }] });
    expect(submit.status).toBe(200);
    expect(submit.body.attempt.percentScore).toBe(100);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    const completed = list.body.notifications.find((n) => n.kind === 'assessment_completed');
    expect(completed).toBeTruthy();
    expect(completed.message).toContain('100%');
  });

  it('creates a shortlisted notification for each candidate', async () => {
    const created = await request(app)
      .post('/api/recruiter/shortlists')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ name: 'Talent Pool', candidateIds: [studentId] });
    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    const shortlisted = list.body.notifications.find((n) => n.kind === 'shortlisted');
    expect(shortlisted).toBeTruthy();
    expect(shortlisted.data.shortlistName).toBe('Talent Pool');
    expect(shortlisted.isRead).toBe(false);
  });

  it('creates a shortlisted notification only for newly added candidates on update', async () => {
    const created = await request(app)
      .post('/api/recruiter/shortlists')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ name: 'Talent Pool', candidateIds: [studentId] });
    const shortlistId = created.body.id;

    const updated = await request(app)
      .put(`/api/recruiter/shortlists/${shortlistId}`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ candidateIds: [studentId, otherId] });
    expect(updated.status).toBe(200);

    const studentList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentList.body.notifications.filter((n) => n.kind === 'shortlisted')).toHaveLength(1);
  });
});