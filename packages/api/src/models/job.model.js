import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    _id: { type: String },
    title: { type: String, required: true, maxlength: 200, index: true },
    company: { type: String, maxlength: 200, default: null },
    location: { type: String, maxlength: 100, default: null, index: true },
    source: { type: String, maxlength: 50, default: 'demo' },
    description: { type: String, maxlength: 10000, default: null },
    postedAt: { type: String, default: null },
    collectedDate: { type: String, index: true },
    experienceYears: { type: Number, default: null },
    roleId: { type: String, default: null, index: true },
    recruiterId: { type: String, default: null, index: true },
    normalizedTitle: { type: String, default: null },
    normalizedLocation: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'jobs', strict: false },
);

jobSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Job = mongoose.model('Job', jobSchema);