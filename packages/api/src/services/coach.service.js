import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { Evidence } from '../models/evidence.model.js';
import { Skill } from '../models/skill.model.js';
import { Profile } from '../models/profile.model.js';
import { AppError } from '../utils/errors.js';
import { computeReadinessReport } from './readiness.service.js';
import env from '../config/env.js';

const SYSTEM_PROMPT = `You are a career intelligence coach for technology students and professionals. You help users understand their career readiness, identify skill gaps, and plan their next steps.

Guidelines:
- Base your advice on the evidence and readiness data provided in context
- Be honest about what the data shows — never fabricate proficiency claims
- Recommend concrete actions (specific skills to learn, types of projects, assessment areas)
- When data is insufficient, say so rather than guessing
- Reference specific skills and readiness dimensions when relevant
- Keep responses actionable and concise
- If the user asks about something outside career coaching, gently redirect`;

function buildContextBlock(readinessSummary, evidenceHighlights, marketInsights) {
  const parts = [];

  if (readinessSummary && readinessSummary.roles?.length > 0) {
    parts.push('READINESS DATA:');
    for (const role of readinessSummary.roles) {
      const dims = role.dimensions ?? {};
      parts.push(`- ${role.roleName}: overall ${role.overall ?? 'N/A'}%`);
      if (dims.technical != null) parts.push(`  Technical: ${dims.technical}%`);
      if (dims.professional != null) parts.push(`  Professional: ${dims.professional}%`);
      if (dims.marketAlignment != null) parts.push(`  Market alignment: ${dims.marketAlignment}%`);
      if (dims.evidenceConfidence != null) parts.push(`  Evidence confidence: ${dims.evidenceConfidence}%`);
      if (role.strengths?.length > 0) {
        parts.push(`  Strengths: ${role.strengths.map((s) => s.skillName).join(', ')}`);
      }
      if (role.criticalGaps?.length > 0) {
        parts.push(`  Critical gaps: ${role.criticalGaps.map((g) => g.skillName).join(', ')}`);
      }
      if (role.mediumGaps?.length > 0) {
        parts.push(`  Medium gaps: ${role.mediumGaps.map((g) => g.skillName).join(', ')}`);
      }
      if (role.nextBestAction) {
        parts.push(`  Next best action: ${role.nextBestAction.action} — ${role.nextBestAction.reason}`);
      }
    }
  }

  if (evidenceHighlights && evidenceHighlights.length > 0) {
    parts.push('\nEVIDENCE HIGHLIGHTS:');
    for (const e of evidenceHighlights) {
      parts.push(`- ${e.skillName}: confidence ${e.confidenceScore}% (${e.sources?.length ?? 0} sources)`);
    }
  }

  if (marketInsights && marketInsights.length > 0) {
    parts.push('\nMARKET INSIGHTS:');
    for (const m of marketInsights) {
      parts.push(`- ${m.roleName}: demand ${m.demandLabel ?? 'unknown'}, top skills: ${(m.topSkills ?? []).join(', ')}`);
    }
  }

  return parts.join('\n');
}

async function gatherContext(userId) {
  const [readinessSummary, evidenceRecords, profile] = await Promise.all([
    computeReadinessReport(userId).catch(() => null),
    Evidence.find({ userId }).sort({ confidenceScore: -1 }).limit(10).lean(),
    Profile.findOne({ userId }).lean(),
  ]);

  const skillIds = evidenceRecords.map((e) => e.skillId);
  const skills = await Skill.find({ _id: { $in: skillIds } }).lean();
  const skillNameMap = new Map(skills.map((s) => [String(s._id), s.name]));

  const evidenceHighlights = evidenceRecords.map((e) => ({
    skillName: skillNameMap.get(e.skillId) ?? e.skillId,
    confidenceScore: e.confidenceScore ?? 0,
    sources: e.sources,
  }));

  // Market insights are limited — just return readiness market data
  const marketInsights = (readinessSummary?.roles ?? [])
    .filter((r) => r.marketExplanation)
    .map((r) => ({
      roleName: r.roleName,
      demandLabel: r.dimensions?.marketAlignment != null ? 'benchmarked' : 'no data',
      topSkills: (r.strengths ?? []).map((s) => s.skillName),
    }));

  return { readinessSummary, evidenceHighlights, marketInsights, targetRoleIds: profile?.targetRoleIds ?? [] };
}

function buildMessages(history, userMessage, contextBlock) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (contextBlock) {
    messages.push({
      role: 'system',
      content: `Here is the user's career data. Use it to inform your responses:\n\n${contextBlock}`,
    });
  }

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}

async function callLLM(messages) {
  const apiUrl = env.llmApiUrl;
  const apiKey = env.llmApiKey;
  const model = env.llmModel;

  if (!apiUrl || !apiKey) {
    return "I'm the Career Intelligence Coach, but my AI service isn't configured yet. Please set the LLM_API_URL and LLM_API_KEY environment variables to enable conversational coaching.";
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(`LLM API error (${response.status}): ${text}`, 502);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'No response generated.';
}

export async function listConversations(userId) {
  return Conversation.find({ userId }).sort({ updatedAt: -1 }).lean();
}

export async function getConversation(userId, conversationId) {
  const conv = await Conversation.findOne({ _id: conversationId, userId }).lean();
  if (!conv) throw new AppError('Conversation not found', 404);
  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();
  return { ...conv, messages };
}

export async function sendMessage(userId, { conversationId, content }) {
  let conv;
  if (conversationId) {
    conv = await Conversation.findOne({ _id: conversationId, userId });
    if (!conv) throw new AppError('Conversation not found', 404);
  } else {
    conv = new Conversation({ userId, title: content.slice(0, 100) });
    await conv.save();
  }

  // Save user message
  const userMsg = new Message({
    conversationId: conv._id,
    userId,
    role: 'user',
    content,
  });
  await userMsg.save();

  // Gather RAG context
  const context = await gatherContext(userId);
  const contextBlock = buildContextBlock(
    context.readinessSummary,
    context.evidenceHighlights,
    context.marketInsights,
  );

  // Get conversation history (last 20 messages for context window)
  const history = await Message.find({ conversationId: conv._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  history.reverse();

  const llmMessages = buildMessages(history, content, contextBlock);
  const reply = await callLLM(llmMessages);

  // Save assistant message
  const assistantMsg = new Message({
    conversationId: conv._id,
    userId,
    role: 'assistant',
    content: reply,
    context: {
      readinessSummary: context.readinessSummary,
      marketInsights: context.marketInsights,
      evidenceHighlights: context.evidenceHighlights,
    },
  });
  await assistantMsg.save();

  // Update conversation timestamp and title
  conv.updatedAt = new Date();
  if (!conv.title || conv.messages?.length <= 1) {
    conv.title = content.slice(0, 100);
  }
  await conv.save();

  return {
    messageId: String(assistantMsg._id),
    conversationId: String(conv._id),
    content: reply,
    context: assistantMsg.context,
  };
}

export async function deleteConversation(userId, conversationId) {
  const conv = await Conversation.findOne({ _id: conversationId, userId });
  if (!conv) throw new AppError('Conversation not found', 404);
  await Message.deleteMany({ conversationId });
  await conv.deleteOne();
  return true;
}
