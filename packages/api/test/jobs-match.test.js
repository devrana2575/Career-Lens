import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser, signAccessToken } from '../src/services/auth.service.js';
import { matchResumeToJobs } from '../src/services/matching.client.js';

vi.mock('../src/services/matching.client.js', () => ({
  matchResumeToJobs: vi.fn(),
}));

const app = createApp();
let token;
let counter = 0;

const MATCH_RESPONSE = {
  matches: [
    {
      jobId: 'job-match-1',
      title: 'Python Data Engineer',
      company: 'Acme',
      location: 'Remote',
      experienceYears: 3,
      postedAt: null,
      source: 'demo',
      fitScore: 78,
      skillCoverage: 75,
      textSimilarity: 82,
      matchedSkills: [
        { skillId: 'skill-python', name: 'Python', category: 'language', strength: 'high', mentions: 3 },
      ],
      missingSkills: [{ skillId: 'skill-sql', name: 'SQL', category: 'database' }],
      insights: ['This posting asks for 2 recognized skills.'],
      recommendations: ['Add evidence for SQL to raise your coverage.'],
    },
  ],
  candidate: {
    skills: [
      { skillId: 'skill-python', name: 'Python', category: 'language', strength: 'high', mentions: 3 },
    ],
    detectedSkills: 1,
  },
  summary: {
    jobsEvaluated: 2,
    meanFit: 78,
    bestFit: 78,
    bestJob: { jobId: 'job-match-1', title: 'Python Data Engineer' },
  },
  note: 'Fit scores are textual-overlap estimates.',
};

beforeEach(async () => {
  counter += 1;
  vi.mocked(matchResumeToJobs).mockReset();
  const user = await registerUser({
    email: `match+${counter}@example.com`,
    displayName: 'Match Tester',
    password: 'password123',
    role: 'student',
  });
  token = signAccessToken(user);
});

describe('resume-to-job matching API', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/jobs/match').send({ text: 'Python' });
    expect(res.status).toBe(401);
  });

  it('returns ranked matches from the data service', async () => {
    vi.mocked(matchResumeToJobs).mockResolvedValue(MATCH_RESPONSE);
    const res = await request(app)
      .post('/api/jobs/match')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python and SQL.', limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.matches[0].jobId).toBe('job-match-1');
    expect(res.body.matches[0].fitScore).toBe(78);
    expect(res.body.summary.bestFit).toBe(78);
    expect(res.body.note).toContain('textual-overlap');
  });

  it('forwards the request body to the data service', async () => {
    vi.mocked(matchResumeToJobs).mockResolvedValue(MATCH_RESPONSE);
    await request(app)
      .post('/api/jobs/match')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python daily.', jobIds: ['job-a', 'job-b'], limit: 20 });
    expect(matchResumeToJobs).toHaveBeenCalledWith({
      text: 'Python daily.',
      jobIds: ['job-a', 'job-b'],
      limit: 20,
    });
  });

  it('rejects empty resume text', async () => {
    const res = await request(app)
      .post('/api/jobs/match')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '   ' });
    expect(res.status).toBe(422);
    expect(matchResumeToJobs).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range limit', async () => {
    const res = await request(app)
      .post('/api/jobs/match')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python', limit: 51 });
    expect(res.status).toBe(422);
  });

  it('surfaces a 502 when the matching service is unavailable', async () => {
    const { AppError } = await import('../src/utils/errors.js');
    vi.mocked(matchResumeToJobs).mockRejectedValue(new AppError('Job matching service unavailable', 502));
    const res = await request(app)
      .post('/api/jobs/match')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Python' });
    expect(res.status).toBe(502);
  });
});