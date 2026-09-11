import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Job } from '../src/models/job.model.js';

const app = createApp();
let counter = 0;
let studentToken;
let recruiterToken;
let recruiterId;
let jobId;

beforeEach(async () => {
  counter += 1;
  const student = await registerUser({
    email: `app-stud+${counter}@example.com`, displayName: 'S', password: 'password123', role: 'student',
  });
  const recruiter = await registerUser({
    email: `app-rec+${counter}@example.com`, displayName: 'R', password: 'password123', role: 'recruiter',
  });
  studentToken = signAccessToken(student);
  recruiterToken = signAccessToken(recruiter);
  recruiterId = String(recruiter._id ?? recruiter.id);
  const job = await Job.create({
    _id: `job-app-${counter}`,
    title: 'Data Scientist',
    company: 'Acme',
    location: 'Remote',
    description: 'Analyze data',
    collectedDate: new Date().toISOString(),
    isActive: true,
    isDemo: true,
    recruiterId,
  });
  jobId = String(job._id);
});

describe('job applications for students', () => {
  it('requires authentication to list or apply', async () => {
    expect((await request(app).get('/api/applications')).status).toBe(401);
    expect(
      (await request(app).post('/api/applications').send({ jobId })).status,
    ).toBe(401);
  });

  it('applies to a job and lists it with enrichment', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('applied');

    const list = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(list.body.length).toBe(1);
    expect(list.body[0].job.title).toBe('Data Scientist');
  });

  it('rejects duplicate applications', async () => {
    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });
    const dup = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });
    expect(dup.status).toBe(409);
  });

  it('updates status and withdraws', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });
    const id = created.body.id;

    const updated = await request(app)
      .patch(`/api/applications/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'interviewing', notes: 'phone screen' });
    expect(updated.body.status).toBe('interviewing');

    const del = await request(app)
      .delete(`/api/applications/${id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(del.status).toBe(204);
  });

  it('lets recruiters post a job that students can list', async () => {
    const posted = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: 'ML Engineer', company: 'Beta', location: 'Remote' });
    expect(posted.status).toBe(201);

    const list = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(list.body.some((j) => j.title === 'ML Engineer')).toBe(true);
  });

  it('forbids students from posting jobs', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
  });
});

describe('recruiter applications management', () => {
  it('lists applicants for recruiter jobs', async () => {
    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });

    const list = await request(app)
      .get('/api/recruiter/applications')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].job.title).toBe('Data Scientist');
    expect(list.body[0].candidate.displayName).toBe('S');
  });

  it('returns 200 empty list when recruiter owns no jobs', async () => {
    const other = await registerUser({
      email: `app-rec-empty+${counter}@example.com`, displayName: 'R2', password: 'password123', role: 'recruiter',
    });
    const otherToken = signAccessToken(other);
    const list = await request(app)
      .get('/api/recruiter/applications')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });

  it('updates application status and notifies the student', async () => {
    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });

    const applications = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`);
    const appId = applications.body[0]._id;

    const updated = await request(app)
      .patch(`/api/recruiter/applications/${appId}`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'interviewing' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('interviewing');

    const studentApps = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentApps.body[0].status).toBe('interviewing');
  });

  it('rejects status updates from non-owner recruiters', async () => {
    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });

    const applications = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`);
    const appId = applications.body[0]._id;

    const other = await registerUser({
      email: `app-rec-other+${counter}@example.com`, displayName: 'R2', password: 'password123', role: 'recruiter',
    });
    const otherToken = signAccessToken(other);

    const res = await request(app)
      .patch(`/api/recruiter/applications/${appId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'offered' });
    expect(res.status).toBe(404);
  });

  it('rejects invalid status values', async () => {
    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ jobId });

    const applications = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${studentToken}`);
    const appId = applications.body[0]._id;

    const res = await request(app)
      .patch(`/api/recruiter/applications/${appId}`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'garbage' });
    expect(res.status).toBe(422);
  });
});