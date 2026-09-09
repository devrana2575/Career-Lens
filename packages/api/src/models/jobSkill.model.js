import mongoose from 'mongoose';

const jobSkillSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId },
    jobId: { type: String, index: true, required: true },
    skillId: { type: String, index: true, required: true },
  },
  { timestamps: true, collection: 'jobSkills', strict: false },
);

jobSkillSchema.index({ jobId: 1, skillId: 1 }, { unique: true });

export const JobSkill = mongoose.model('JobSkill', jobSkillSchema);