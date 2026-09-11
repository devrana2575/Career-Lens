import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { addEvidenceSource } from '../src/services/evidence.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Competency } from '../src/models/competency.model.js';
import { Role } from '../src/models/role.model.js';
import { RoleRequirement } from '../src/models/roleRequirement.model.js';
import { Profile } from '../src/models/profile.model.js';
import { Notification } from '../src/models/notification.model.js';

const app = createApp();
let counter = 0;
let recruiterToken;

async function seedOntology() {
  await Promise.all([
    Skill.create([
      { _id: 'skill-rp', name: 'Python', slug: 'python', category: 'language' },
      { _id: 'skill-rs', name: 'SQL', slug: 'sql', category: 'database' },
    ]),
    Role.create({ _id: 'role-recruiter-ds', name: 'Data Scientist', slug: 'recruiter-ds', family: 'Data & Analytics' }),
    Competency.create({ _id: 'comp-r-ds', name: 'Statistics', slug: 'statistics', roleId: 'role-recruiter-ds', skillIds: ['skill-rp'] }),
    RoleRequirement.create({ _id: 'req-r-python', roleId: 'role-recruiter-ds', competencyId: 'comp-r-ds', skillId: 'skill-rp', baselineLevel: 'critical', weight: 1 }),
  ]);
}

async function makeStudent(email) {
  const user = await registerUser({ email, displayName: 'Student', password: 'password123', role: 'student' });
  await Profile.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, targetRoleIds: ['role-recruiter-ds'], headline: 'Aspiring DS' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await addEvidenceSource(user._id, 'skill-rp', { type: 'coding_assessment', score: 85 });
  return user;
}

beforeEach(async () => {
  counter += 1;
  const recruiter = await registerUser({
    email: `recruiter+${counter}@example.com`,
    displayName: 'Recruiter',
    password: 'password123',
    role: 'recruiter',
  });
  recruiterToken = signAccessToken(recruiter);
  await seedOntology();
});

describe('recruiter candidates', () => {
  it('forbids students from the recruiter area', async () => {
    const student = await registerUser({
      email: `forbidden+${counter}@example.com`, displayName: 'S', password: 'password123', role: 'student',
    });
    const res = await request(app)
      .get('/api/recruiter/candidates')
      .set('Authorization', `Bearer ${signAccessToken(student)}`);
    expect(res.status).toBe(403);
  });

  it('lists students as candidates with evidence and top skills', async () => {
    await makeStudent(`cand+${counter}@example.com`);
    const res = await request(app)
      .get('/api/recruiter/candidates')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    const candidate = res.body[0];
    expect(candidate.targetRoles[0].roleName).toBe('Data Scientist');
    expect(candidate.evidenceCount).toBe(1);
    expect(candidate.topSkills[0].skillName).toBe('Python');
  });

  it('filters candidates by role and skill search', async () => {
    await makeStudent(`candf1+${counter}@example.com`);
    const res = await request(app)
      .get('/api/recruiter/candidates?skill=pyth')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    const empty = await request(app)
      .get('/api/recruiter/candidates?skill=java')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(empty.body.length).toBe(0);
  });

  it('returns recent evidence in the candidate detail', async () => {
    const student = await makeStudent(`detail+${counter}@example.com`);
    const res = await request(app)
      .get(`/api/recruiter/candidates/${student._id}`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.recentEvidence.length).toBe(1);
    expect(res.body.recentEvidence[0].skillName).toBe('Python');
  });

  it('compares up to 5 candidates', async () => {
    const s1 = await makeStudent(`comp1+${counter}@example.com`);
    const s2 = await makeStudent(`comp2+${counter}@example.com`);
    const res = await request(app)
      .post('/api/recruiter/candidates/compare')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ candidateIds: [String(s1._id), String(s2._id)] });
    expect(res.status).toBe(200);
    expect(res.body.candidates.length).toBe(2);
  });

  it('rejects fewer than 2 candidates for comparison', async () => {
    const s1 = await makeStudent(`compbad+${counter}@example.com`);
    const res = await request(app)
      .post('/api/recruiter/candidates/compare')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ candidateIds: [String(s1._id)] });
    expect(res.status).toBe(422);
  });
});

describe('recruiter shortlists', () => {
  it('creates a shortlist and notifies the candidates', async () => {
    const student = await makeStudent(`sl1+${counter}@example.com`);
    const res = await request(app)
      .post('/api/recruiter/shortlists')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ name: 'Top picks', candidateIds: [String(student._id)] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Top picks');

    const note = await Notification.findOne({ userId: student._id, kind: 'shortlisted' }).lean();
    expect(note).toBeTruthy();
    expect(note.message).toContain('Top picks');
  });

  it('updates and deletes a shortlist', async () => {
    const created = await request(app)
      .post('/api/recruiter/shortlists')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ name: 'Frame' });
    const id = created.body.id;

    const updated = await request(app)
      .put(`/api/recruiter/shortlists/${id}`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ name: 'Final' });
    expect(updated.body.name).toBe('Final');

    const del = await request(app)
      .delete(`/api/recruiter/shortlists/${id}`)
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(del.status).toBe(204);
  });
});