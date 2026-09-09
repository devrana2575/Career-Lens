import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, index: true, maxlength: 100 },
    family: { type: String, required: true, maxlength: 100, index: true },
    description: { type: String, maxlength: 1500, default: null },
    competencyIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'roles', strict: false },
);

roleSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Role = mongoose.model('Role', roleSchema);