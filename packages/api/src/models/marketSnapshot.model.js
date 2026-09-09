import mongoose from 'mongoose';

const skillFrequencySchema = new mongoose.Schema(
  {
    skillId: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false, strict: false },
);

const experienceYearsSchema = new mongoose.Schema(
  {
    min: { type: Number, default: null },
    avg: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  { _id: false, strict: false },
);

const marketSnapshotSchema = new mongoose.Schema(
  {
    snapshotDate: { type: String, required: true, index: true },
    roleId: { type: String, required: true, index: true },
    location: { type: String, required: true, index: true },
    source: { type: String, required: true, default: 'demo' },
    jobCount: { type: Number, required: true, min: 0 },
    skillFrequencies: { type: [skillFrequencySchema], default: [] },
    experienceYears: { type: experienceYearsSchema, default: null },
    dataVolume: { type: String, default: null },
    confidence: { type: String, enum: ['sufficient', 'insufficient'], default: 'insufficient' },
    demoData: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'marketSnapshots', strict: false },
);

marketSnapshotSchema.index(
  { snapshotDate: 1, roleId: 1, location: 1, source: 1 },
  { unique: true },
);

marketSnapshotSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const MarketSnapshot = mongoose.model('MarketSnapshot', marketSnapshotSchema);