import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: String, required: true },
    status: {
      type: String,
      enum: ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'],
      default: 'applied',
    },
    notes: { type: String, maxlength: 2000, default: null },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'job_applications' },
);

jobApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

jobApplicationSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);