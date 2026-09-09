import mongoose from 'mongoose';

const roleRequirementSchema = new mongoose.Schema(
  {
    _id: { type: String },
    roleId: { type: String, required: true, index: true },
    competencyId: { type: String, required: true },
    skillId: { type: String, required: true },
    baselineLevel: {
      type: String,
      enum: ['optional', 'preferred', 'required', 'critical'],
      default: 'required',
    },
    minYearsExperience: { type: Number, min: 0, max: 30, default: 0 },
    weight: { type: Number, min: 0, max: 1 },
    source: { type: String, enum: ['curated', 'market', 'admin'], default: 'curated' },
  },
  { timestamps: true, collection: 'roleRequirements', strict: false },
);

roleRequirementSchema.index({ roleId: 1, skillId: 1 }, { unique: true });

roleRequirementSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const RoleRequirement = mongoose.model('RoleRequirement', roleRequirementSchema);