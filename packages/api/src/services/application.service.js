import { JobApplication } from '../models/jobApplication.model.js';
import { Job } from '../models/job.model.js';
import { AppError } from '../utils/errors.js';

const VALID_STATUSES = ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];

export async function listApplications(userId) {
  const applications = await JobApplication.find({ userId }).sort({ appliedAt: -1 }).lean();
  const jobIds = applications.map((a) => a.jobId);
  const jobs = await Job.find({ _id: { $in: jobIds } }).lean();
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));
  return applications.map((a) => ({
    ...a,
    job: jobMap.get(a.jobId) ?? null,
  }));
}

export async function applyToJob(userId, { jobId }) {
  const job = await Job.findById(jobId).lean();
  if (!job || job.isActive === false) {
    throw new AppError('Job not found', 404);
  }
  try {
    const application = await JobApplication.create({ userId, jobId, status: 'applied' });
    return application;
  } catch {
    throw new AppError('You already applied to this job', 409);
  }
}

export async function updateApplication(userId, applicationId, { status, notes }) {
  const application = await JobApplication.findOne({ _id: applicationId, userId });
  if (!application) throw new AppError('Application not found', 404);
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) throw new AppError('Invalid application status', 422);
    application.status = status;
  }
  if (notes !== undefined) application.notes = notes;
  await application.save();
  return application;
}

export async function withdrawApplication(userId, applicationId) {
  const result = await JobApplication.deleteOne({ _id: applicationId, userId });
  if (result.deletedCount === 0) throw new AppError('Application not found', 404);
  return true;
}