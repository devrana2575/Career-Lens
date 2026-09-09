import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('auth', () => {
  describe('POST /api/auth/register', () => {
    it('registers a student and returns tokens', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'student@example.com',
        password: 'password123',
        displayName: 'Test Student',
        role: 'student',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('student@example.com');
      expect(res.body.user.role).toBe('student');
      expect(res.body.tokens.accessToken).toBeTruthy();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects duplicate emails', async () => {
      const payload = {
        email: 'dupe@example.com',
        password: 'password123',
        displayName: 'Dupe',
      };
      await request(app).post('/api/auth/register').send(payload);
      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.status).toBe(409);
    });

    it('rejects invalid payloads', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'short',
        displayName: '',
      });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const creds = {
        email: 'login@example.com',
        password: 'password123',
        displayName: 'Login User',
      };
      await request(app).post('/api/auth/register').send(creds);

      const res = await request(app).post('/api/auth/login').send({
        email: creds.email,
        password: creds.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.tokens.accessToken).toBeTruthy();
    });

    it('rejects wrong password', async () => {
      const creds = {
        email: 'wrongpass@example.com',
        password: 'password123',
        displayName: 'Wrong Pass',
      };
      await request(app).post('/api/auth/register').send(creds);

      const res = await request(app).post('/api/auth/login').send({
        email: creds.email,
        password: 'nope-nope-nope',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        email: 'me@example.com',
        password: 'password123',
        displayName: 'Me User',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${reg.body.tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reg.body.user.id);
    });

    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});