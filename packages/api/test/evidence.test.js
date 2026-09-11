import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { computeEvidenceScores } from '../src/services/evidence.service.js';

const app = createApp();
let token;
let otherToken;
let instanceCounter = 0;

async function makeUser(email, displayName = 'Evidence Tester') {
  const user = await registerUser({
    email,
    displayName,
    password: 'password123',
    role: 'student',
  });
  return signAccessToken(user);
}

beforeEach(async () => {
  instanceCounter += 1;
  await Skill.findOneAndUpdate(
    { _id: 'skill-python' },
    {
      $setOnInsert: { name: 'Python', slug: 'python', category: 'language', isActive: true },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  token = await makeUser(`evidence+${instanceCounter}@example.com`);
  otherToken = await makeUser(`other+${instanceCounter}@example.com`);
});

describe('computeEvidenceScores', () => {
  it('returns null proficiency and 0 confidence with no sources', () => {
    expect(computeEvidenceScores([])).toEqual({
      proficiencyScore: null,
      confidenceScore: 0,
    });
  });

  it('uses the strongest numeric non-self-reported source for proficiency', () => {
    const scores = computeEvidenceScores([
      { type: 'github', strength: 'high', score: 70 },
      { type: 'coding_assessment', strength: 'medium', score: 86 },
      { type: 'self_reported', strength: 'low', score: 90 },
    ]);
    expect(scores.proficiencyScore).toBe(86);
    expect(scores.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('falls back to self-reported score when it is the only source', () => {
    const scores = computeEvidenceScores([
      { type: 'self_reported', strength: 'low', score: 60 },
    ]);
    expect(scores.proficiencyScore).toBe(60);
    expect(scores.confidenceScore).toBe(30);
  });

  it('raises confidence with corroborating and recent sources (capped at 100)', () => {
    const single = computeEvidenceScores([{ type: 'certification', strength: 'high' }]);
    const many = computeEvidenceScores([
      { type: 'certification', strength: 'high' },
      { type: 'github', strength: 'high' },
      { type: 'project', strength: 'high' },
    ]);
    expect(single.confidenceScore).toBe(90);
    expect(many.confidenceScore).toBe(100);
  });
});

describe('evidence API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/evidence/graph');
    expect(res.status).toBe(401);
  });

  it('creates evidence for a skill and recomputes scores', async () => {
    const res = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({
        skillId: 'skill-python',
        source: {
          type: 'coding_assessment',
          strength: 'medium',
          score: 82,
          description: 'Python coding assessment',
          occurredAt: '2026-08-01T00:00:00.000Z',
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.evidence.skillId).toBe('skill-python');
    expect(res.body.evidence.proficiencyScore).toBe(82);
    expect(res.body.evidence.sources).toHaveLength(1);
  });

  it('adds a source to existing evidence and re-aggregates', async () => {
    const created = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-python', source: { type: 'github', strength: 'low' } });

    const id = created.body.evidence.id;
    const res = await request(app)
      .post(`/api/evidence/${id}/sources`)
      .set('Authorization', `Bearer ${token}`)
      .send({ source: { type: 'project', strength: 'high', score: 95 } });

    expect(res.status).toBe(200);
    expect(res.body.evidence.sources).toHaveLength(2);
    expect(res.body.evidence.proficiencyScore).toBe(95);
    expect(res.body.evidence.confidenceScore).toBeGreaterThan(60);
  });

  it('keeps a single evidence record per user + skill', async () => {
    await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-python', source: { type: 'certification', strength: 'medium' } });
    await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-python', source: { type: 'github', strength: 'low' } });
    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    expect(graph.status).toBe(200);
    expect(graph.body.skillAssessments).toHaveLength(1);
    expect(graph.body.skillAssessments[0].skillName).toBe('Python');
    expect(graph.body.skillAssessments[0].sources).toHaveLength(2);
  });

  it('keeps distinct evidence records per skill (regression: skillId filter)', async () => {
    await Skill.findOneAndUpdate(
      { _id: 'skill-sql' },
      { $setOnInsert: { name: 'SQL', slug: 'sql', category: 'language', isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-python', source: { type: 'coding_assessment', strength: 'high', score: 88 } });
    await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-sql', source: { type: 'sql_assessment', strength: 'high', score: 74 } });
    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    expect(graph.status).toBe(200);
    const names = graph.body.skillAssessments.map((s) => s.skillName).sort();
    expect(names).toEqual(['Python', 'SQL']);
    const python = graph.body.skillAssessments.find((s) => s.skillName === 'Python');
    const sql = graph.body.skillAssessments.find((s) => s.skillName === 'SQL');
    expect(python.proficiencyScore).toBe(88);
    expect(sql.proficiencyScore).toBe(74);
  });

  it('rejects unknown skills (no unexplained scores)', async () => {
    const res = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-does-not-exist', source: { type: 'github', strength: 'low' } });
    expect(res.status).toBe(404);
  });

  it('does not leak another user\'s evidence', async () => {
    await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-python', source: { type: 'github', strength: 'low' } });
    const res = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.skillAssessments).toHaveLength(0);
  });

  it('lets the owner delete evidence', async () => {
    const created = await request(app)
      .post('/api/evidence')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: 'skill-python', source: { type: 'github', strength: 'low' } });
    const id = created.body.evidence.id;
    const del = await request(app)
      .delete(`/api/evidence/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
    const graph = await request(app)
      .get('/api/evidence/graph')
      .set('Authorization', `Bearer ${token}`);
    expect(graph.body.skillAssessments).toHaveLength(0);
  });
});

describe('skills API', () => {
  it('lists ontology skills for the skill picker', async () => {
    const res = await request(app)
      .get('/api/skills')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const python = res.body.skills.find((s) => s.slug === 'python');
    expect(python.name).toBe('Python');
    expect(python.id).toBe('skill-python');
  });
});