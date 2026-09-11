import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';

const app = createApp();
let counter = 0;
let token;

beforeEach(async () => {
  counter += 1;
  const user = await registerUser({
    email: `sandbox+${counter}@example.com`,
    displayName: 'Sandbox Tester',
    password: 'password123',
  });
  token = signAccessToken(user);
});

describe('sandbox endpoints', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/sandbox/sql').send({ query: 'SELECT 1' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing query', async () => {
    const res = await request(app)
      .post('/api/sandbox/sql')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('returns 502 when the execution service is unreachable', async () => {
    const res = await request(app)
      .post('/api/sandbox/sql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'SELECT 1' });
    expect(res.status).toBe(502);
  });

  it('rejects invalid code payloads', async () => {
    const res = await request(app)
      .post('/api/sandbox/code')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'python' });
    expect(res.status).toBe(422);
  });
});