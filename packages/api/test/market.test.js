import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Role } from '../src/models/role.model.js';
import { Skill } from '../src/models/skill.model.js';
import { MarketSnapshot } from '../src/models/marketSnapshot.model.js';

const app = createApp();

function snapshot(overrides = {}) {
  return {
    snapshotDate: '2026-07-01',
    roleId: 'role-data-scientist',
    location: 'bengaluru',
    source: 'demo',
    jobCount: 6,
    skillFrequencies: [
      { skillId: 'skill-python', count: 6 },
      { skillId: 'skill-pytorch', count: 4 },
    ],
    experienceYears: { min: 2, avg: 4, max: 7 },
    dataVolume: '6 postings',
    confidence: 'sufficient',
    demoData: true,
    ...overrides,
  };
}

async function seedOntology() {
  await Role.create({
    _id: 'role-data-scientist',
    name: 'Data Scientist',
    slug: 'data-scientist',
    family: 'Data & Analytics',
    isActive: true,
  });
  await Skill.create([
    { _id: 'skill-python', name: 'Python', slug: 'python', category: 'language' },
    { _id: 'skill-pytorch', name: 'PyTorch', slug: 'pytorch', category: 'library' },
  ]);
}

describe('GET /api/market/overview', () => {
  it('returns an empty overview when no snapshots exist', async () => {
    const res = await request(app).get('/api/market/overview');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalSnapshots: 0, totalJobs: 0, rolesCovered: 0 });
    expect(res.body.asOfDate).toBeNull();
  });

  it('aggregates the latest date across snapshots', async () => {
    await seedOntology();
    await MarketSnapshot.create([
      snapshot({
        snapshotDate: '2026-06-01',
        jobCount: 5,
        skillFrequencies: [{ skillId: 'skill-python', count: 5 }],
      }),
      snapshot({
        snapshotDate: '2026-07-01',
        jobCount: 6,
        skillFrequencies: [{ skillId: 'skill-python', count: 6 }],
      }),
      snapshot({
        snapshotDate: '2026-07-01',
        jobCount: 2,
        location: 'london',
        skillFrequencies: [{ skillId: 'skill-python', count: 2 }],
      }),
    ]);

    const res = await request(app).get('/api/market/overview');
    expect(res.status).toBe(200);
    expect(res.body.asOfDate).toBe('2026-07-01');
    expect(res.body.totalSnapshots).toBe(3);
    expect(res.body.totalJobs).toBe(8);
    expect(res.body.rolesCovered).toBe(1);
    expect(res.body.locations).toEqual(['bengaluru', 'london']);
    expect(res.body.sources).toEqual(['demo']);
    expect(res.body.demoData).toBe(true);
  });
});

describe('GET /api/market/benchmarks', () => {
  it('returns role benchmarks with volumes, skills and demand', async () => {
    await seedOntology();
    await MarketSnapshot.create([
      snapshot({
        snapshotDate: '2026-06-01',
        jobCount: 4,
        skillFrequencies: [
          { skillId: 'skill-python', count: 4 },
          { skillId: 'skill-pytorch', count: 1 },
        ],
      }),
      snapshot({
        snapshotDate: '2026-07-01',
        jobCount: 6,
        skillFrequencies: [
          { skillId: 'skill-python', count: 6 },
          { skillId: 'skill-pytorch', count: 4 },
        ],
      }),
    ]);

    const res = await request(app).get('/api/market/benchmarks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const b = res.body[0];
    expect(b.roleName).toBe('Data Scientist');
    expect(b.roleSlug).toBe('data-scientist');
    expect(b.snapshotDate).toBe('2026-07-01');
    expect(b.jobVolume).toBe(6);
    expect(b.confidence).toBe('sufficient');
    expect(b.demand).toBe('rising');
    expect(b.topSkills[0]).toMatchObject({
      skillId: 'skill-python',
      skillName: 'Python',
      count: 6,
      share: 1,
    });
    expect(b.experienceYears).toEqual({ min: 2, avg: 4, max: 7 });
    expect(b.locations[0]).toEqual({ location: 'bengaluru', jobCount: 6 });
  });

  it('marks low-volume benchmarks as insufficient', async () => {
    await seedOntology();
    await MarketSnapshot.create([
      snapshot({
        snapshotDate: '2026-07-01',
        jobCount: 2,
        skillFrequencies: [{ skillId: 'skill-python', count: 2 }],
      }),
    ]);

    const res = await request(app).get('/api/market/benchmarks');
    const b = res.body[0];
    expect(b.confidence).toBe('insufficient');
    expect(b.demand).toBe('insufficient');
    expect(b.dataVolume).toBe('2 postings');
  });

  it('resolves a single benchmark by slug and 404s for unknown roles', async () => {
    await seedOntology();
    await MarketSnapshot.create([snapshot()]);

    const bySlug = await request(app).get('/api/market/benchmarks/data-scientist');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.roleId).toBe('role-data-scientist');

    const missing = await request(app).get('/api/market/benchmarks/qa-automation-engineer');
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/market/skills/trends', () => {
  it('computes stable and rising skill trends', async () => {
    await seedOntology();
    await MarketSnapshot.create([
      snapshot({
        snapshotDate: '2026-06-01',
        jobCount: 5,
        skillFrequencies: [
          { skillId: 'skill-python', count: 5 },
          { skillId: 'skill-pytorch', count: 1 },
        ],
      }),
      snapshot({
        snapshotDate: '2026-07-01',
        jobCount: 6,
        skillFrequencies: [
          { skillId: 'skill-python', count: 6 },
          { skillId: 'skill-pytorch', count: 4 },
        ],
      }),
    ]);

    const res = await request(app).get('/api/market/skills/trends');
    expect(res.status).toBe(200);
    const python = res.body.find((t) => t.skillId === 'skill-python');
    const pytorch = res.body.find((t) => t.skillId === 'skill-pytorch');

    expect(python.trend).toBe('stable');
    expect(python.latestShare).toBe(1);
    expect(python.series).toEqual([
      { snapshotDate: '2026-06-01', mentions: 5, jobs: 5, share: 1 },
      { snapshotDate: '2026-07-01', mentions: 6, jobs: 6, share: 1 },
    ]);

    expect(pytorch.trend).toBe('rising');
    expect(pytorch.latestShare).toBeCloseTo(4 / 6, 3);
  });

  it('returns insufficient for single-date skills', async () => {
    await seedOntology();
    await MarketSnapshot.create([
      snapshot({
        snapshotDate: '2026-07-01',
        jobCount: 6,
        skillFrequencies: [{ skillId: 'skill-python', count: 6 }],
      }),
    ]);

    const res = await request(app).get('/api/market/skills/trends');
    const python = res.body.find((t) => t.skillId === 'skill-python');
    expect(python.trend).toBe('insufficient');
    expect(python.confidence).toBe('sufficient'); // volume is enough, dates are not
    expect(python.series).toHaveLength(1);
  });

  it('404s for an unknown skill', async () => {
    const res = await request(app).get('/api/market/skills/skill-unknown/trend');
    expect(res.status).toBe(404);
  });
});