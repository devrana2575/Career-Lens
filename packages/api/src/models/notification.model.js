import mongoose from 'mongoose';

export const NOTIFICATION_KINDS = ['assessment_completed', 'assessment_reviewed', 'shortlisted'];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, required: true, enum: NOTIFICATION_KINDS },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'notifications',
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.createdAt = ret.createdAt instanceof Date ? ret.createdAt.toISOString() : ret.createdAt;
    ret.readAt = ret.readAt instanceof Date ? ret.readAt.toISOString() : null;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Notification = mongoose.model('Notification', notificationSchema);