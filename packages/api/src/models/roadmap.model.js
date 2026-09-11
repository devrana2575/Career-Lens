import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    skillId: { type: String, required: true },
    skillName: { type: String, required: true },
    action: { type: String, required: true },
    reason: { type: String, required: true },
    impact: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    effortEstimate: { type: String, default: null },
    status: { type: String, enum: ['open', 'done'], default: 'open' },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const roadmapSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    roleId: { type: String, required: true },
    roleSlug: { type: String, default: null },
    roleName: { type: String, required: true },
    tasks: { type: [taskSchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'roadmaps',
  },
);

roadmapSchema.index({ userId: 1, roleId: 1 }, { unique: true });

roadmapSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    const open = ret.tasks.filter((t) => t.status !== 'done').length;
    ret.progress = ret.tasks.length === 0 ? 0 : Math.round(((ret.tasks.length - open) / ret.tasks.length) * 100);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Roadmap = mongoose.model('Roadmap', roadmapSchema);