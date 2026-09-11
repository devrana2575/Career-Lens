import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { sendMailLite, emailEnabled } from './mailer.service.js';

function toJson(doc) {
  return {
    id: String(doc._id),
    kind: doc.kind,
    title: doc.title,
    message: doc.message,
    data: doc.data ?? {},
    isRead: Boolean(doc.isRead),
    readAt: doc.readAt ? new Date(doc.readAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function createNotification({ userId, kind, title, message, data = {} }) {
  const notification = await Notification.create({ userId, kind, title, message, data });
  if (emailEnabled()) {
    User.findById(userId).lean().then((user) => {
      if (user?.email) sendMailLite({ to: user.email, subject: title, text: message }).catch(() => {});
    }).catch(() => {});
  }
  return toJson(notification);
}

export async function listNotifications(userId, limit = 50) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId, isRead: false }),
  ]);
  return { notifications: notifications.map(toJson), unreadCount };
}

export async function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}

export async function markOneRead(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true, runValidators: true },
  ).lean();
  return updated ? toJson(updated) : null;
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return result.modifiedCount ?? 0;
}

export async function notifyShortlistedCandidates(candidateIds, { shortlistId, shortlistName }) {
  const docs = candidateIds.map((candidateId) => ({
    userId: candidateId,
    kind: 'shortlisted',
    title: 'You were added to a shortlist',
    message: `A recruiter added you to the shortlist "${shortlistName}".`,
    data: { shortlistId, shortlistName },
  }));
  if (docs.length === 0) return 0;
  const created = await Notification.insertMany(docs);
  return created.length;
}