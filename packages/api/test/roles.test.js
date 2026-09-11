import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Role } from '../src/models/role.model.js';
import { Competency } from '../src/models/competency.model.js';
import { Skill } from '../src/models/skill.model.js';
import { RoleRequirement } from '../src/models/roleRequirement.model.js';

const app = createApp();

async function seedOntology() {
  await Promise.all([
    Skill.deleteMany({}),
    Role.deleteMany({}),
    Competency.deleteMany({}),
    RoleRequirement.deleteMany({}),
  ]);
  await Skill.create([
    { _id: 'skill-python', name: 'Python', slug: 'python', category: 'language' },
    { _id: 'skill-sql', name: 'SQL', slug: 'sql', category: 'language' },
    { _id: 'skill-statistics', name: 'Statistics', slug: 'statistics', category: 'concept' },
  ]);
  const role = await Role.create({
    _id: 'role-data-scientist',
    name: 'Data Scientist',
    slug: 'data-scientist',
    family: 'Data & Analytics',
  });
  await Competency.create({
    _id: 'comp-ds-stats',
    name: 'Statistics',
    slug: 'statistics',
    roleId: 'role-data-scientist',
    skillIds: ['skill-python', 'skill-statistics'],
  });
  await RoleRequirement.create([
    { _id: 'req-role-data-scientist-skill-python', roleId: 'role-data-scientist', competencyId: 'comp-ds-stats', skillId: 'skill-python', baselineLevel: 'critical', weight: 0.6 },
    { _id: 'req-role-data-scientist-skill-statistics', roleId: 'role-data-scientist', competencyId: 'comp-ds-stats', skillId: 'skill-statistics', baselineLevel: 'required', weight: 0.4 },
  ]);
  return role;
}

describe('roles', () => {
  let roleSlug;

  beforeEach(async () => {
    const role = await seedOntology();
    roleSlug = String(role.slug);
  });

  it('lists roles grouped by family', async () => {
    const res = await request(app).get('/api/roles');
    expect(res.status).toBe(200);
    expect(res.body.families).toContain('Data & Analytics');
    expect(res.body.roles.some((r) => r.slug === roleSlug)).toBe(true);
  });

  it('returns a role with competencies, skills and requirements', async () => {
    const res = await request(app).get(`/api/roles/${roleSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Data Scientist');
    const stats = res.body.competencies.find((c) => c.slug === 'statistics');
    expect(stats.skills.map((s) => s.name)).toContain('Python');
    const req = res.body.requirements.find((r) => r.skillId === 'skill-python');
    expect(req.baselineLevel).toBe('critical');
  });

  it('returns a role when looked up by id', async () => {
    const bySlug = await request(app).get(`/api/roles/${roleSlug}`);
    const id = bySlug.body.id;
    const res = await request(app).get(`/api/roles/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.competencies.length).toBe(1);
  });

  it('returns 404 for unknown role', async () => {
    const res = await request(app).get('/api/roles/does-not-exist');
    expect(res.status).toBe(404);
  });
});