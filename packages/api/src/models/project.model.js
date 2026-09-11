import mongoose from 'mongoose';

const skillUsedSchema = new mongoose.Schema(
  {
    skillSlug: { type: String, required: true },
    skillId: { type: String, required: true },
    role: { type: String, maxlength: 100, default: null },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    url: { type: String, maxlength: 2000, default: null },
    repoUrl: { type: String, maxlength: 2000, default: null },
    techStack: { type: [String], default: [] },
    skillsUsed: { type: [skillUsedSchema], default: [] },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isOngoing: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'projects',
  },
);

projectSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Project = mongoose.model('Project', projectSchema);
