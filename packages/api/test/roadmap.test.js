import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Competency } from '../src/models/competency.model.js';
import { Role } from '../src/models/role.model.js';
import { RoleRequirement } from '../src/models/roleRequirement.model.js';
import { Profile } from '../src/models/profile.model.js';
import { Roadmap } from '../src/models/roadmap.model.js';
import { addEvidenceSource } from '../src/services/evidence.service.js';

const app = createApp();
let userId;
let token;
let instanceCounter = 0;

async function seedOntology() {
  await Promise.all([
    Skill.create([{ _id: 'skill-python', name: 'Python', slug: 'python', category: 'language' }]),
    Role.create({ _id: 'role-roadmap-ds', name: 'Data Scientist', slug: 'data-scientist', family: 'Data & Analytics' }),
    Competency.create({ _id: 'comp-rm-stats', name: 'Statistics', slug: 'statistics', roleId: 'role-roadmap-ds', skillIds: ['skill-python'] }),
    RoleRequirement.create({ _id: 'req-rm-python', roleId: 'role-roadmap-ds', competencyId: 'comp-rm-stats', skillId: 'skill-python', baselineLevel: 'critical', weight: 1 }),
  ]);
}

beforeEach(async () => {
  instanceCounter += 1;
  const user = await registerUser({
    email: `roadmap+${instanceCounter}@example.com`,
    displayName: 'Roadmap Tester',
    password: 'password123',
    role: 'student',
  });
  userId = String(user._id);
  token = signAccessToken(user);
  await Profile.findOneAndUpdate(
    { userId },
    { $set: { userId, targetRoleIds: ['role-roadmap-ds'] } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await seedOntology();
  await Roadmap.deleteMany({ userId });
});

describe('personalized roadmap', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/roadmap');
    expect(res.status).toBe(401);
  });

  it('returns an empty list before a roadmap is generated', async () => {
    const res = await request(app).get('/api/roadmap').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.roadmaps).toEqual([]);
  });

  it('generates a roadmap from the readiness snapshot', async () => {
    const res = await request(app)
      .post('/api/roadmap/generate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.roadmaps).toHaveLength(1);
    const roadmap = res.body.roadmaps[0];
    expect(roadmap.roleName).toBe('Data Scientist');
    expect(roadmap.progress).toBe(0);
    expect(roadmap.tasks.length).toBeGreaterThan(0);
    expect(roadmap.tasks[0]).toMatchObject({
      skillName: 'Python',
      action: 'Record evidence for Python',
      impact: 'high',
      status: 'open',
    });
  });

  it('toggles a task and answers 404 for unknown roadmaps or tasks', async () => {
    await request(app).post('/api/roadmap/generate').set('Authorization', `Bearer ${token}`);
    const list = await request(app).get('/api/roadmap').set('Authorization', `Bearer ${token}`);
    const roadmap = list.body.roadmaps[0];
    const taskId = roadmap.tasks[0].id;

    const toggled = await request(app)
      .patch(`/api/roadmap/${roadmap.id}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.tasks[0].status).toBe('done');
    expect(toggled.body.progress).toBeGreaterThan(0);

    const missing = await request(app)
      .patch(`/api/roadmap/${roadmap.id}/tasks/does-not-exist`)
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);

    const notMine = await request(app)
      .patch(`/api/roadmap/000000000000000000000000/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(notMine.status).toBe(404);
  });

  it('preserves completion across regenerations', async () => {
    await request(app).post('/api/roadmap/generate').set('Authorization', `Bearer ${token}`);
    const first = await request(app).get('/api/roadmap').set('Authorization', `Bearer ${token}`);
    const roadmap = first.body.roadmaps[0];
    const taskId = roadmap.tasks[0].id;
    await request(app)
      .patch(`/api/roadmap/${roadmap.id}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    const regenerated = roadmap.tasks[0].skillId === 'skill-python'
      ? await request(app).post('/api/roadmap/generate').set('Authorization', `Bearer ${token}`)
      : null;
    const next = await request(app).get('/api/roadmap').set('Authorization', `Bearer ${token}`);
    const refreshed = next.body.roadmaps[0];
    expect(refreshed.tasks.find((t) => t.skillId === 'skill-python').status).toBe('done');
    if (regenerated) {
      expect(regenerated.body.roadmaps[0].tasks.length).toBeGreaterThan(0);
    }
  });

  it('clears tasks from the roadmap once a critical skill is proven', async () => {
    await addEvidenceSource(userId, 'skill-python', {
      type: 'coding_assessment',
      strength: 'high',
      score: 90,
    });
    const res = await request(app)
      .post('/api/roadmap/generate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.roadmaps[0].tasks).toEqual([]);
    expect(res.body.roadmaps[0].progress).toBe(0);
  });

  it('deletes a roadmap', async () => {
    await request(app).post('/api/roadmap/generate').set('Authorization', `Bearer ${token}`);
    const list = await request(app).get('/api/roadmap').set('Authorization', `Bearer ${token}`);
    const del = await request(app)
      .delete(`/api/roadmap/${list.body.roadmaps[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
    const after = await request(app).get('/api/roadmap').set('Authorization', `Bearer ${token}`);
    expect(after.body.roadmaps).toEqual([]);
  });
});