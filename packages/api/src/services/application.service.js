import { JobApplication } from '../models/jobApplication.model.js';
import { Job } from '../models/job.model.js';
import { User } from '../models/user.model.js';
import { createNotification } from './notification.service.js';
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

export async function listRecruiterApplications(recruiterId) {
  const jobs = await Job.find({ recruiterId }).lean();
  const jobIds = jobs.map((j) => String(j._id));
  if (jobIds.length === 0) return [];
  const applications = await JobApplication.find({ jobId: { $in: jobIds } }).sort({ appliedAt: -1 }).lean();
  const userIds = [...new Set(applications.map((a) => a.userId))];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [String(u._id), { displayName: u.displayName, email: u.email }]));
  return applications.map((a) => ({
    ...a,
    job: jobMap.get(a.jobId) ?? null,
    candidate: userMap.get(a.userId) ?? null,
  }));
}

export async function updateApplicationByRecruiter(recruiterId, applicationId, { status }) {
  if (!VALID_STATUSES.includes(status)) throw new AppError('Invalid application status', 422);
  const application = await JobApplication.findById(applicationId).lean();
  if (!application) throw new AppError('Application not found', 404);
  const job = await Job.findById(application.jobId).lean();
  if (!job || job.recruiterId !== recruiterId) throw new AppError('Application not found', 404);
  await JobApplication.updateOne({ _id: applicationId }, { $set: { status } });
  createNotification({
    userId: application.userId,
    kind: 'application_status',
    title: 'Application update',
    message: `Your application for "${job.title}" is now: ${status}`,
    data: { applicationId, jobId: String(job._id) },
  }).catch(() => {});
  return { ...application, status };
}