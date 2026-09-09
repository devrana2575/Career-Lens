import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    selectedOptionId: { type: String, default: null },
    text: { type: String, default: null },
    isCorrect: { type: Boolean, default: null },
    points: { type: Number, min: 0, default: 0 },
    maxPoints: { type: Number, min: 0, default: 0 },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const attemptSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    assessmentId: { type: String, required: true, index: true },
    competencyId: { type: String, default: null },
    status: { type: String, enum: ['in_progress', 'scored'], default: 'in_progress' },
    startedAt: { type: Date, default: () => new Date() },
    submittedAt: { type: Date, default: null },
    answers: { type: [answerSchema], default: [] },
    totalScore: { type: Number, min: 0, default: 0 },
    maxScore: { type: Number, min: 0, default: 0 },
    percentScore: { type: Number, min: 0, max: 100, default: null },
  },
  { timestamps: true, collection: 'assessmentAttempts', strict: false },
);

attemptSchema.index({ userId: 1, assessmentId: 1 });

attemptSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const AssessmentAttempt = mongoose.model('AssessmentAttempt', attemptSchema);