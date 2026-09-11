import mongoose from 'mongoose';

const coachContextSchema = new mongoose.Schema(
  {
    readinessSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    marketInsights: { type: mongoose.Schema.Types.Mixed, default: null },
    evidenceHighlights: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    context: { type: coachContextSchema, default: null },
  },
  {
    timestamps: true,
    collection: 'messages',
  },
);

messageSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Message = mongoose.model('Message', messageSchema);
