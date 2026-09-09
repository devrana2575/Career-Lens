import mongoose from 'mongoose';
import { EVIDENCE_TYPES } from '@career/shared';

const evidenceSourceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: EVIDENCE_TYPES, required: true },
    referenceId: { type: String, default: null },
    url: { type: String, maxlength: 2000, default: null },
    description: { type: String, maxlength: 2000, default: null },
    score: { type: Number, min: 0, max: 100, default: null },
    occurredAt: { type: Date, default: null },
  },
  { _id: false, strict: false },
);

const evidenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    competencyId: { type: String, default: null },
    sources: { type: [evidenceSourceSchema], default: [] },
    proficiencyScore: { type: Number, min: 0, max: 100, default: null },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    lastEvaluatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'evidence',
    strict: false,
    toJSON: {
      virtuals: false,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/** One evidence record per (user, skill). */
evidenceSchema.index({ userId: 1, skillId: 1 }, { unique: true });

export const Evidence = mongoose.model('Evidence', evidenceSchema);