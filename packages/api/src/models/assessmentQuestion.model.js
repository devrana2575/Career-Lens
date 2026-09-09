import mongoose from 'mongoose';
import { ASSESSMENT_TYPES, QuestionDifficultySchema } from '@career/shared';

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    _id: { type: String },
    assessmentId: { type: String, required: true, index: true },
    skillId: { type: String, required: true, index: true },
    type: { type: String, enum: ASSESSMENT_TYPES, default: 'mcq' },
    prompt: { type: String, required: true, maxlength: 2000 },
    options: { type: [optionSchema], default: [] },
    correctOptionId: { type: String, default: null },
    explanation: { type: String, maxlength: 2000, default: null },
    difficulty: {
      type: String,
      enum: QuestionDifficultySchema.options,
      default: 'intermediate',
    },
    points: { type: Number, min: 0, default: 1 },
    orderIndex: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'assessmentQuestions', strict: false },
);

questionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const AssessmentQuestion = mongoose.model('AssessmentQuestion', questionSchema);