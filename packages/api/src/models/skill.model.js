import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: null },
    category: {
      type: String,
      enum: ['language', 'framework', 'tool', 'concept', 'domain', 'soft', 'library', 'database'],
      default: 'concept',
    },
    parentId: { type: String, default: null },
    children: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'skills', strict: false },
);

skillSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Skill = mongoose.model('Skill', skillSchema);