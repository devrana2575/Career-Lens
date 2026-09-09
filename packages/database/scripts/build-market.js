import dotenv from 'dotenv';

dotenv.config();

/**
 * Triggers the data-service market pipeline over HTTP (operations call).
 * The pipeline cleans/deduplicates the demo jobs, extracts skills, classifies
 * roles and writes append-only market snapshots into Mongo.
 */
const url = process.env.DATA_SERVICE_URL || 'http://localhost:8000';
const apiKey = process.env.DATA_API_KEY || 'change-me';

async function main() {
  const res = await fetch(`${url}/api/market/build`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`Market build failed (${res.status}):`, body);
    process.exit(1);
  }
  console.log('Market build complete.');
  for (const [key, value] of Object.entries(body)) {
    console.log(`  ${key}: ${value}`);
  }
}

main().catch((err) => {
  console.error('Market build failed:', err);
  process.exit(1);
});