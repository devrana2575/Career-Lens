import { matchResumeToJobs } from './matching.client.js';

/**
 * Resume-to-job matching.
 *
 * All scoring happens in the data service (prominence-weighted skill coverage
 * plus TF-IDF text similarity). The API validates the request, delegates, and
 * returns the ranked matches — every number already carries a reason downstream.
 */
export async function matchJobs({ text, jobIds, limit }) {
  return matchResumeToJobs({ text, jobIds, limit });
}