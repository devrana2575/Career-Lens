import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { Skill } from '../src/models/skill.model.js';
import { Evidence } from '../src/models/evidence.model.js';
import { getEvidenceGraph } from '../src/services/evidence.service.js';
import { analyzeResume as analyzeResumeRemote } from '../src/services/resume.client.js';

vi.mock('../src/services/resume.client.js', () => ({
  analyzeResume: vi.fn(),
}));

const app = createApp();
let userId;
let token;
let instanceCounter = 0;

beforeEach(async () => {
  instanceCounter += 1;
  vi.mocked(analyzeResumeRemote).mockReset();
  const user = await registerUser({
    email: `resume+${instanceCounter}@example.com`,
    displayName: 'Resume Tester',
    password: 'password123',
    role: 'student',
  });
  userId = String(user._id);
  token = signAccessToken(user);
  await Skill.create([
    { _id: 'skill-python', name: 'Python', slug: 'python', category: 'language' },
    { _id: 'skill-sql', name: 'SQL', slug: 'sql', category: 'database' },
  ]);
});

describe('resume analysis API', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/resume/analyze').send({ text: 'Python' });
    expect(res.status).toBe(401);
  });

  it('records resume evidence for matched ontology skills (no proficiency score)', async () => {
    vi.mocked(analyzeResumeRemote).mockResolvedValue({
      fileName: 'resume.txt',
      matchedSkills: [
        { skillId: 'skill-python', name: 'Python', category: 'language', mentions: 3, strength: 'high' },
        { skillId: 'skill-sql', name: 'SQL', category: 'database', mentions: 1, strength: 'low' },
      ],
      note: 'Prominence only.',
    });

    const res = await request(app)
      .post('/api/resume/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python daily, some SQL.', fileName: 'resume.txt' });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(2);
    expect(res.body.skipped).toBe(0);

    const graph = await getEvidenceGraph(userId);
    const python = graph.skillAssessments.find((s) => s.skillId === 'skill-python');
    expect(python.sources).toHaveLength(1);
    expect(python.sources[0]).toMatchObject({ type: 'resume', strength: 'high' });
    expect(python.proficiencyScore).toBeNull();
    expect(python.confidenceScore).toBeGreaterThan(0);
  });

  it('re-upload replaces the earlier resume source for the same skill', async () => {
    const matched = [
      { skillId: 'skill-python', name: 'Python', category: 'language', mentions: 1, strength: 'low' },
    ];
    vi.mocked(analyzeResumeRemote).mockResolvedValue({ fileName: 'v2.txt', matchedSkills: matched, note: null });

    await request(app)
      .post('/api/resume/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python mention.', fileName: 'v1.txt' });
    const res = await request(app)
      .post('/api/resume/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python mention.', fileName: 'v2.txt' });
    expect(res.status).toBe(200);
    const python = await Evidence.findOne({ userId, skillId: 'skill-python' }).lean();
    const resumeSources = python.sources.filter((s) => s.type === 'resume');
    expect(resumeSources).toHaveLength(1);
    expect(resumeSources[0].description).toContain('v2.txt');
  });

  it('skips matched skills that are not in the ontology (no unexplained skills)', async () => {
    vi.mocked(analyzeResumeRemote).mockResolvedValue({
      fileName: null,
      matchedSkills: [{ skillId: 'skill-nope', name: 'Nope', category: null, mentions: 1, strength: 'low' }],
      note: null,
    });
    const res = await request(app)
      .post('/api/resume/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Nope' });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('surfaces a 502 when the analysis service is unavailable', async () => {
    const { AppError } = await import('../src/utils/errors.js');
    vi.mocked(analyzeResumeRemote).mockRejectedValue(new AppError('Resume analysis service unavailable', 502));
    const res = await request(app)
      .post('/api/resume/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python' });
    expect(res.status).toBe(502);
  });

  it('rejects empty text', async () => {
    const res = await request(app)
      .post('/api/resume/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '' });
    expect(res.status).toBe(422);
  });
});