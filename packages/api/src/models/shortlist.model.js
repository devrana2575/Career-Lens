import mongoose from 'mongoose';

const shortlistSchema = new mongoose.Schema(
  {
    recruiterId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 200 },
    candidateIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
    collection: 'shortlists',
  },
);

shortlistSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Shortlist = mongoose.model('Shortlist', shortlistSchema);
