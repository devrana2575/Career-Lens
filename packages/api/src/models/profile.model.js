import mongoose from 'mongoose';

const educationRecordSchema = new mongoose.Schema(
  {
    institution: { type: String, required: true, maxlength: 200 },
    degreeType: {
      type: String,
      enum: ['btech', 'mtech', 'bsc', 'msc', 'bca', 'mca', 'other'],
      default: null,
    },
    level: {
      type: String,
      enum: ['high_school', 'diploma', 'undergraduate', 'postgraduate'],
      required: true,
    },
    field: { type: String, required: true, maxlength: 200 },
    startYear: { type: Number, min: 1950, max: 2100, required: true },
    endYear: { type: Number, min: 1950, max: 2100, default: null },
    cgpa: { type: Number, min: 0, max: 10, default: null },
    isCurrent: { type: Boolean, default: false },
  },
  { _id: false },
);

const selfReportedSkillSchema = new mongoose.Schema(
  {
    skillId: { type: String, required: true },
    claimedLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      required: true,
    },
  },
  { _id: false },
);

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    profileType: {
      type: String,
      enum: ['student', 'recruiter'],
      required: true,
      index: true,
    },
    // --- Student fields ---
    headline: { type: String, maxlength: 160, default: null },
    bio: { type: String, maxlength: 2000, default: null },
    location: { type: String, maxlength: 120, default: null },
    education: { type: [educationRecordSchema], default: [] },
    yearsOfExperience: { type: Number, min: 0, max: 50, default: 0 },
    githubUsername: { type: String, maxlength: 120, default: null, index: true },
    portfolioUrl: { type: String, default: null },
    linkedinUrl: { type: String, default: null },
    selfReportedSkills: { type: [selfReportedSkillSchema], default: [] },
    targetRoleIds: { type: [String], default: [] },
    // --- Recruiter fields ---
    company: { type: String, maxlength: 160, default: null },
    title: { type: String, maxlength: 160, default: null },
  },
  {
    timestamps: true,
    collection: 'profiles',
  },
);

profileSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Profile = mongoose.model('Profile', profileSchema);