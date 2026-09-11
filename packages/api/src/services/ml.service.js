import env from '../config/env.js';

/**
 * Optional machine-learning skill ranking seam. When an ML service is running
 * (ML_API_URL) it predicts the true proficiency of a skill from its sources;
 * callers can inject the result into the evidence graph. When the service is
 * unavailable the system falls back to the built-in heuristic scoring.
 */
export async function rankSkillProficiency({ userId, skillId, sources }) {
  if (!env.mlApiUrl) return null;
  try {
    const res = await fetch(`${env.mlApiUrl}/v1/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.mlApiKey ? { Authorization: `Bearer ${env.mlApiKey}` } : {}),
      },
      body: JSON.stringify({ userId, skillId, sources }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.proficiency != null ? Number(data.proficiency) : null;
  } catch {
    return null;
  }
}