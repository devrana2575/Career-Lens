import { z } from 'zod';

export const NOTIFICATION_KINDS = ['assessment_completed', 'assessment_reviewed', 'shortlisted'];

export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);

export const NotificationSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  message: z.string(),
  data: z.record(z.unknown()).default({}),
  isRead: z.boolean(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  unreadCount: z.number().int().min(0),
});

export const UnreadCountResponseSchema = z.object({
  unreadCount: z.number().int().min(0),
});