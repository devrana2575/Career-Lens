import mongoose from 'mongoose';
import { ASSESSMENT_TYPES } from '@career/shared';

const assessmentSchema = new mongoose.Schema(
  {
    _id: { type: String },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 1000, default: null },
    type: { type: String, enum: ASSESSMENT_TYPES, required: true },
    skillId: { type: String, required: true, index: true },
    roleId: { type: String, default: null, index: true },
    timeLimitMinutes: { type: Number, min: 1, default: 10 },
    isActive: { type: Boolean, default: true },
    version: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true, collection: 'assessments', strict: false },
);

assessmentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Assessment = mongoose.model('Assessment', assessmentSchema);