import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { addEvidenceSource } from '../src/services/evidence.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Message } from '../src/models/message.model.js';

const app = createApp();
let counter = 0;
let userId;
let token;

beforeEach(async () => {
  counter += 1;
  const user = await registerUser({
    email: `coach+${counter}@example.com`,
    displayName: 'Coach Tester',
    password: 'password123',
  });
  userId = String(user._id);
  token = signAccessToken(user);
  await Skill.create({ _id: 'skill-coach-python', name: 'Python', slug: 'coach-python', category: 'language' });
  await addEvidenceSource(userId, 'skill-coach-python', { type: 'coding_assessment', score: 82 });
});

describe('coach with grounding', () => {
  it('persists the message and retrieves evidence notes without an LLM configured', async () => {
    const res = await request(app)
      .post('/api/coach/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'What can I do to strengthen my Python profile?' });
    expect(res.status).toBe(200);
    expect(res.body.content).toContain('Python');
    expect(res.body.context.retrievedNotes).toContain('evidence:Python evidence');
    expect(res.body.context.evidenceHighlights[0].skillName).toBe('Python');

    const saved = await Message.findOne({ conversationId: res.body.conversationId, role: 'assistant' }).lean();
    expect(saved).toBeTruthy();
    expect(saved.context.retrievedNotes).toContain('Python');
  });

  it('keeps a conversation and history across messages', async () => {
    const first = await request(app)
      .post('/api/coach/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello there' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/coach/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ conversationId: first.body.conversationId, content: 'Tell me about Python' });
    expect(second.status).toBe(200);

    const list = await request(app)
      .get(`/api/coach/conversations/${first.body.conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.messages.length).toBe(4);
  });
});