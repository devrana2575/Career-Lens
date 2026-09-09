import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Competency } from '../src/models/competency.model.js';
import { Role } from '../src/models/role.model.js';
import { RoleRequirement } from '../src/models/roleRequirement.model.js';
import { Profile } from '../src/models/profile.model.js';
import { computeReadinessReport, analyzeRole } from '../src/services/readiness.service.js';

const app = createApp();
let userId;
let token;
let instanceCounter = 0;

async function seedOntology() {
  await Promise.all([
    Skill.create([
      { _id: 'skill-python', name: 'Python', slug: 'python', category: 'language' },
      { _id: 'skill-sql', name: 'SQL', slug: 'sql', category: 'database' },
      { _id: 'skill-communication', name: 'Communication', slug: 'communication', category: 'soft' },
    ]),
    Role.create({ _id: 'role-data-scientist', name: 'Data Scientist', slug: 'data-scientist', family: 'Data & Analytics' }),
    Competency.create({ _id: 'comp-ds-stats', name: 'Statistics', slug: 'statistics', roleId: 'role-data-scientist', skillIds: ['skill-python', 'skill-sql'] }),
    RoleRequirement.create([
      { _id: 'req-ds-python', roleId: 'role-data-scientist', competencyId: 'comp-ds-stats', skillId: 'skill-python', baselineLevel: 'critical', weight: 0.5 },
      { _id: 'req-ds-sql', roleId: 'role-data-scientist', competencyId: 'comp-ds-stats', skillId: 'skill-sql', baselineLevel: 'required', weight: 0.3 },
      { _id: 'req-ds-comm', roleId: 'role-data-scientist', competencyId: 'comp-ds-stats', skillId: 'skill-communication', baselineLevel: 'preferred', weight: 0.2 },
    ]),
  ]);
}

beforeEach(async () => {
  instanceCounter += 1;
  const user = await registerUser({
    email: `readiness+${instanceCounter}@example.com`,
    displayName: 'Readiness Tester',
    password: 'password123',
    role: 'student',
  });
  userId = String(user._id);
  token = signAccessToken(user);
  await Profile.findOneAndUpdate(
    { userId },
    { $set: { userId, targetRoleIds: ['role-data-scientist'] } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await seedOntology();
});

describe('readiness engine', () => {
  it('reports no roles when the user has no target role', async () => {
    await Profile.updateOne({ userId }, { $set: { targetRoleIds: [] } });
    const report = await computeReadinessReport(userId);
    expect(report.roles).toHaveLength(0);
  });

  it('gives a 0-baseline estimate and lists every requirement as missing evidence', async () => {
    const report = await computeReadinessReport(userId);
    const role = report.roles[0];
    expect(role.roleName).toBe('Data Scientist');
    expect(role.overall).toBe(0);
    expect(role.missingEvidence.map((m) => m.skillName).sort()).toEqual(['Communication', 'Python', 'SQL']);
    expect(role.nextBestAction.impact).toBe('high');
  });

  it('raised scores lower gaps and adds strengths once evidence exists', async () => {
    const { Evidence } = await import('../src/models/evidence.model.js');
    const { addEvidenceSource } = await import('../src/services/evidence.service.js');
    await addEvidenceSource(userId, 'skill-python', {
      type: 'coding_assessment',
      strength: 'high',
      score: 86,
    });

    const report = await computeReadinessReport(userId);
    const role = report.roles[0];

    expect(role.overall).toBeGreaterThan(0);
    expect(role.strengths.map((s) => s.skillName)).toContain('Python');
    expect(role.criticalGaps.map((g) => g.skillName)).toEqual([]);
    // SQL still gap + no evidence for it
    expect(role.missingEvidence.map((m) => m.skillName)).toContain('SQL');
  });

  it('self-reported evidence counts less than validated evidence', async () => {
    const { Evidence } = await import('../src/models/evidence.model.js');
    const { addEvidenceSource } = await import('../src/services/evidence.service.js');
    await addEvidenceSource(userId, 'skill-python', {
      type: 'self_reported',
      strength: 'low',
      score: 90,
    });
    const { items } = await analyzeRole(userId, 'role-data-scientist');
    const python = items.find((i) => i.skillId === 'skill-python');
    expect(python.quality).toBe('self_reported');
    const validated = await addEvidenceSource(userId, 'skill-python', {
      type: 'coding_assessment',
      strength: 'high',
      score: 80,
    });
    const { items: items2 } = await analyzeRole(userId, 'role-data-scientist');
    const python2 = items2.find((i) => i.skillId === 'skill-python');
    expect(python2.quality).toBe('validated');
    expect(python2.effective).toBe(80);
    void validated;
  });

  it('explains that missing evidence is not a missing skill', async () => {
    const report = await computeReadinessReport(userId);
    const entry = report.roles[0].missingEvidence[0];
    expect(entry.note).toContain('Missing evidence does not mean missing skill');
  });
});

describe('readiness market alignment', () => {
  it('stays blank with an honest explanation until a market benchmark exists', async () => {
    const report = await computeReadinessReport(userId);
    const role = report.roles[0];
    expect(role.dimensions.marketAlignment).toBeNull();
    expect(role.marketExplanation).toContain('No market benchmark');
    expect(report.explanation).toContain('no fabricated numbers');
  });

  it('stays blank when the benchmark volume is too sparse', async () => {
    const { MarketSnapshot } = await import('../src/models/marketSnapshot.model.js');
    await MarketSnapshot.create({
      snapshotDate: '2026-03-02',
      roleId: 'role-data-scientist',
      location: 'remote',
      jobCount: 2,
      source: 'test',
      confidence: 'insufficient',
      skillFrequencies: [{ skillId: 'skill-python', count: 2 }],
    });
    const report = await computeReadinessReport(userId);
    expect(report.roles[0].dimensions.marketAlignment).toBeNull();
    expect(report.roles[0].marketExplanation).toContain('too sparse');
  });

  it('computes the evidence-weighted share of market-demanded skills', async () => {
    const { Evidence } = await import('../src/models/evidence.model.js');
    const { addEvidenceSource } = await import('../src/services/evidence.service.js');
    const { MarketSnapshot } = await import('../src/models/marketSnapshot.model.js');
    await MarketSnapshot.create({
      snapshotDate: '2026-03-02',
      roleId: 'role-data-scientist',
      location: 'remote',
      jobCount: 6,
      source: 'test',
      confidence: 'sufficient',
      skillFrequencies: [
        { skillId: 'skill-python', count: 6 },
        { skillId: 'skill-sql', count: 4 },
      ],
    });
    await addEvidenceSource(userId, 'skill-python', {
      type: 'coding_assessment',
      strength: 'high',
      score: 86,
    });

    const report = await computeReadinessReport(userId);
    const role = report.roles[0];
    expect(role.dimensions.marketAlignment).toBe(54);
    expect(role.marketExplanation).toContain('1 of 2');
    expect(report.explanation).toContain('compare');
    void Evidence;
  });

  it('mentions market demand in roadmap reasons for demanded skills', async () => {
    const { MarketSnapshot } = await import('../src/models/marketSnapshot.model.js');
    await MarketSnapshot.create({
      snapshotDate: '2026-03-02',
      roleId: 'role-data-scientist',
      location: 'remote',
      jobCount: 6,
      source: 'test',
      confidence: 'sufficient',
      skillFrequencies: [
        { skillId: 'skill-python', count: 6 },
        { skillId: 'skill-sql', count: 4 },
      ],
    });
    const report = await computeReadinessReport(userId);
    const roadmap = report.roles[0].roadmap;
    const sql = roadmap.find((r) => r.skillName === 'SQL');
    expect(sql).toBeDefined();
    expect(sql.reason).toContain('67% of recent Data Scientist postings');
  });
});

describe('readiness API', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/readiness');
    expect(res.status).toBe(401);
  });

  it('returns a full report shape for a target role', async () => {
    const { Evidence } = await import('../src/models/evidence.model.js');
    const { addEvidenceSource } = await import('../src/services/evidence.service.js');
    await addEvidenceSource(userId, 'skill-python', {
      type: 'coding_assessment',
      strength: 'high',
      score: 86,
    });

    const res = await request(app)
      .get('/api/readiness')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const role = res.body.roles[0];
    expect(role.overall).toBeGreaterThan(0);
    expect(role.dimensions.marketAlignment).toBeNull();
    expect(res.body.explanation).toContain('no fabricated numbers');
    const roadmap = role.roadmap;
    expect(roadmap.length).toBeGreaterThan(0);
    expect(roadmap[0].action).toMatch(/^(Improve|Record evidence for) /);

    const bySlug = await request(app)
      .get('/api/readiness/roles/data-scientist')
      .set('Authorization', `Bearer ${token}`);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.roleSlug).toBe('data-scientist');
    void Evidence;
  });

  it('404s for a role not in the user targets', async () => {
    const res = await request(app)
      .get('/api/readiness/roles/software-developer')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
