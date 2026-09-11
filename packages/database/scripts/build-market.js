import dotenv from 'dotenv';

dotenv.config();

/**
 * Triggers the data-service market pipeline over HTTP (operations call).
 * The build now runs as a background job: enqueue it, then poll the status
 * endpoint until the job is completed or failed.
 */
const url = process.env.DATA_SERVICE_URL || 'http://localhost:8000';
const apiKey = process.env.DATA_API_KEY || 'change-me';
const pollMs = Number(process.env.DATA_BUILD_POLL_MS || 2000);
const maxAttempts = Number(process.env.DATA_BUILD_MAX_ATTEMPTS || 60);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const headers = { 'X-API-Key': apiKey };

  const enqueue = await fetch(`${url}/api/market/build`, {
    method: 'POST',
    headers,
  });
  const enqueued = await enqueue.json();
  if (!enqueue.ok) {
    console.error(`Market build enqueue failed (${enqueue.status}):`, enqueued);
    process.exit(1);
  }
  console.log(`Build enqueued: ${enqueued.jobId} (status: ${enqueued.status}).`);

  const statusUrl = `${url}${enqueued.statusUrl || `/api/jobs/${enqueued.jobId}`}`;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(pollMs);
    const statusRes = await fetch(statusUrl, { headers });
    const job = await statusRes.json();
    if (!statusRes.ok) {
      console.error(`Job status check failed (${statusRes.status}):`, job);
      process.exit(1);
    }
    if (job.status === 'completed') {
      console.log('Market build complete.');
      for (const [key, value] of Object.entries(job.result || {})) {
        console.log(`  ${key}: ${value}`);
      }
      return;
    }
    if (job.status === 'failed') {
      console.error(`Market build failed: ${job.error || 'unknown error'}`);
      process.exit(1);
    }
    console.log(`  status: ${job.status} (attempt ${attempt + 1}/${maxAttempts})`);
  }
  console.error('Market build did not finish in time.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Market build failed:', err);
  process.exit(1);
});