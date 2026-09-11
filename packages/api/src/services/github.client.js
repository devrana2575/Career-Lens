import env from '../config/env.js';
import { AppError } from '../utils/errors.js';

const TIMEOUT_MS = 30000;

async function post(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${env.dataServiceUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.dataServiceApiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    throw new AppError('GitHub analysis service unavailable', 502);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AppError(`GitHub analysis service error (${response.status})`, 502);
  }
  return response.json();
}

/** Analyzes a GitHub profile against the ontology and returns matched skills. */
export async function analyzeGitHub({ username }) {
  return post('/api/github/analyze', { username });
}
