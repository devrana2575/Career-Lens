import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, maxlength: 200, default: null },
  },
  {
    timestamps: true,
    collection: 'conversations',
  },
);

conversationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Conversation = mongoose.model('Conversation', conversationSchema);
