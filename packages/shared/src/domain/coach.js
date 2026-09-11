import { z } from 'zod';

/**
 * AI Career Coach — RAG-based conversational interface.
 *
 * The coach answers career questions using the student's readiness data,
 * evidence, and market intelligence as context.
 */

export const CoachMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  context: z
    .object({
      readinessSummary: z.any().optional(),
      marketInsights: z.any().optional(),
      evidenceHighlights: z.any().optional(),
    })
    .optional()
    .nullable(),
  createdAt: z.iso.datetime(),
});

export const CoachConversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().nullable().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CoachConversationWithMessagesSchema = CoachConversationSchema.extend({
  messages: z.array(CoachMessageSchema),
});

export const SendMessageInputSchema = z.object({
  conversationId: z.string().optional().nullable(),
  content: z.string().min(1).max(5000),
});

export const CoachResponseSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  content: z.string(),
  context: z.any().optional().nullable(),
});
