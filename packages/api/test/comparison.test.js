import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Competency } from '../src/models/competency.model.js';
import { Role } from '../src/models/role.model.js';
import { RoleRequirement } from '../src/models/roleRequirement.model.js';
import { Profile } from '../src/models/profile.model.js';

const app = createApp();
let userId;
let token;
let instanceCounter = 0;

async function seedRoles() {
  await Skill.create([
    { _id: 'skill-ml-python', name: 'Python', slug: 'ml-python', category: 'language' },
    { _id: 'skill-ml-ml', name: 'Machine Learning', slug: 'machine-learning', category: 'concept' },
  ]);
  await Role.create([
    { _id: 'role-compare-ds', name: 'Data Scientist', slug: 'compare-ds', family: 'Data & Analytics' },
    { _id: 'role-compare-ml', name: 'ML Engineer', slug: 'compare-ml', family: 'Data & Analytics' },
  ]);
  await Competency.create([
    { _id: 'comp-c-ds', name: 'Stats', slug: 'stats', roleId: 'role-compare-ds', skillIds: ['skill-ml-python'] },
    { _id: 'comp-c-ml', name: 'ML', slug: 'ml', roleId: 'role-compare-ml', skillIds: ['skill-ml-python', 'skill-ml-ml'] },
  ]);
  await RoleRequirement.create([
    { _id: 'req-c-ds-python', roleId: 'role-compare-ds', competencyId: 'comp-c-ds', skillId: 'skill-ml-python', baselineLevel: 'critical', weight: 1 },
    { _id: 'req-c-ml-python', roleId: 'role-compare-ml', competencyId: 'comp-c-ml', skillId: 'skill-ml-python', baselineLevel: 'required', weight: 0.6 },
    { _id: 'req-c-ml-ml', roleId: 'role-compare-ml', competencyId: 'comp-c-ml', skillId: 'skill-ml-ml', baselineLevel: 'critical', weight: 0.4 },
  ]);
}

beforeEach(async () => {
  instanceCounter += 1;
  const user = await registerUser({
    email: `compare+${instanceCounter}@example.com`,
    displayName: 'Compare Tester',
    password: 'password123',
    role: 'student',
  });
  userId = String(user._id);
  token = signAccessToken(user);
  await Profile.findOneAndUpdate(
    { userId },
    { $set: { userId, targetRoleIds: ['role-compare-ds'] } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await seedRoles();
});

describe('role comparison', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/comparison/roles?slugs=a,b');
    expect(res.status).toBe(401);
  });

  it('validates the slugs parameter', async () => {
    const res = await request(app)
      .get('/api/comparison/roles?slugs=role-compare-ds')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });

  it('returns a side-by-side comparison for two roles', async () => {
    const res = await request(app)
      .get('/api/comparison/roles?slugs=role-compare-ds,role-compare-ml')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.roles).toHaveLength(2);
    const [ds, ml] = res.body.roles;
    expect(ds.name).toBe('Data Scientist');
    expect(ml.name).toBe('ML Engineer');
    expect(ml.skills.length).toBe(2);
    expect(typeof ds.dimensions.technical).toBe('number');
    expect(ml.benchmark).toBeNull();
  });
});