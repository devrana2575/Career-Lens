import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, requestEmailVerification } from '../src/services/auth.service.js';
import { clearMailTape, mailTape } from '../src/services/mailer.service.js';
import { User } from '../src/models/user.model.js';

const app = createApp();
let counter = 0;

function tokenFrom(url) {
  const match = /token=([^&\s]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

describe('password reset and email verification', () => {
  it('emails a reset link that actually resets the password', async () => {
    counter += 1;
    clearMailTape();
    const user = await registerUser({
      email: `flow+${counter}@example.com`, displayName: 'Flow', password: 'password123',
    });

    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const link = mailTape.at(-1)?.text ?? '';
    const token = tokenFrom(link
.slice(link.indexOf('http')));
    expect(token).toBeTruthy();

    const bad = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'wrong', password: 'newpassword123' });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'newpassword123' });
    expect(good.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'newpassword123' });
    expect(login.status).toBe(200);
  });

  it('verifies an email address via the emailed link', async () => {
    counter += 1;
    clearMailTape();
    const user = await registerUser({
      email: `verify+${counter}@example.com`, displayName: 'Verify', password: 'password123',
    });

    await requestEmailVerification(user.email);
    const link = mailTape.at(-1)?.text ?? '';
    const token = tokenFrom(link.slice(link.indexOf('http')));
    expect(token).toBeTruthy();

    const bad = await request(app).post('/api/auth/verify-email').send({ token: 'nope' });
    expect(bad.status).toBe(400);

    const good = await request(app).post('/api/auth/verify-email').send({ token });
    expect(good.status).toBe(200);

    const updated = await User.findById(user._id).lean();
    expect(updated.emailVerified).toBe(true);
  });
});