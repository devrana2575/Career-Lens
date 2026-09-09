import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

async function registerAndGetToken(email = `p${Date.now()}@example.com`) {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: 'password123',
    displayName: 'Profile User',
  });
  return { token: res.body.tokens.accessToken, id: res.body.user.id };
}

describe('profiles', () => {
  describe('GET /api/profiles/me', () => {
    it('returns an empty student profile after registration', async () => {
      const { token } = await registerAndGetToken();
      const res = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.profileType).toBe('student');
      expect(res.body.education).toEqual([]);
      expect(res.body.targetRoleIds).toEqual([]);
    });
  });

  describe('PATCH /api/profiles/me', () => {
    it('updates profile fields', async () => {
      const { token } = await registerAndGetToken();
      const res = await request(app)
        .patch('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          headline: 'Aspiring Data Scientist',
          location: 'Bengaluru',
          githubUsername: 'devuser',
          yearsOfExperience: 1,
          selfReportedSkills: [
            { skillId: 'skill-python', claimedLevel: 'advanced' },
          ],
          targetRoleIds: ['role-data-scientist'],
        });

      expect(res.status).toBe(200);
      expect(res.body.headline).toBe('Aspiring Data Scientist');
      expect(res.body.location).toBe('Bengaluru');
      expect(res.body.githubUsername).toBe('devuser');
      expect(res.body.selfReportedSkills[0].claimedLevel).toBe('advanced');
    });

    it('rejects invalid profile payloads', async () => {
      const { token } = await registerAndGetToken();
      const res = await request(app)
        .patch('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ yearsOfExperience: -5 });

      expect(res.status).toBe(422);
    });
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/profiles/me');
    expect(res.status).toBe(401);
  });
});