import mongoose from 'mongoose';

const competencySchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 1000, default: null },
    skillIds: { type: [String], default: [] },
    roleId: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: 'competencies', strict: false },
);

competencySchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Competency = mongoose.model('Competency', competencySchema);