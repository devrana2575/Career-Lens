import env from '../config/env.js';
import { AppError } from '../utils/errors.js';

const TIMEOUT_MS = 20000;

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
    throw new AppError('Execution service unavailable', 502);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AppError(`Execution service error (${response.status})`, 502);
  }
  return response.json();
}

/** Runs a student query against the sandboxed schema and grades it. */
export async function executeSql({ query, schema, expected }) {
  return post('/api/execute/sql', {
    query,
    schema,
    expected,
    timeoutMs: 7000,
  });
}

/** Runs student code against stdin/stdout cases in the sandboxed runner. */
export async function executeCode({ language, code, cases }) {
  return post('/api/execute/code', {
    language,
    code,
    cases,
    timeoutMs: 8000,
  });
}