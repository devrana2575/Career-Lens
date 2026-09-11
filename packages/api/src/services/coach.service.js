import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { Evidence } from '../models/evidence.model.js';
import { Skill } from '../models/skill.model.js';
import { Profile } from '../models/profile.model.js';
import { Roadmap } from '../models/roadmap.model.js';
import { Project } from '../models/project.model.js';
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

  return { readinessSummary, evidenceHighlights, marketInsights, targetRoleIds: profile?.targetRoleIds ?? [], skillNameMap };
}

const STOPWORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been',
  'but', 'by', 'can', 'could', 'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i',
  'if', 'in', 'into', 'is', 'it', 'its', 'like', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our',
  'shall', 'should', 'so', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'to', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'will', 'with', 'would', 'you', 'your',
]);

function tokenize(text) {
  const tokens = String(text ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreChunk(queryTokens, chunkTokens) {
  if (queryTokens.length === 0 || chunkTokens.length === 0) return 0;
  const counts = new Map();
  for (const t of chunkTokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  let overlap = 0;
  for (const t of new Set(queryTokens)) overlap += counts.get(t) ?? 0;
  return overlap / Math.sqrt(chunkTokens.length);
}

async function buildDomainDocuments(userId, readinessSummary, skillNameMap) {
  const docs = [];

  const evidences = await Evidence.find({ userId }).sort({ confidenceScore: -1 }).limit(60).lean();
  for (const e of evidences) {
    const name = skillNameMap.get(e.skillId) ?? e.skillId;
    const sourceLabels = (e.sources ?? [])
      .map((s) => s.type ?? s.title ?? '')
      .filter(Boolean)
      .join(', ');
    docs.push({
      source: 'evidence',
      label: `${name} evidence`,
      text: `${name}: proficiency ${e.proficiencyScore ?? '?'}%, confidence ${e.confidenceScore ?? '?'}%, sources ${sourceLabels}`,
    });
  }

  for (const role of readinessSummary?.roles ?? []) {
    const dims = role.dimensions ?? {};
    const pieces = [
      `${role.roleName} readiness ${role.overall ?? '?'}%`,
      dims.technical != null ? `technical ${dims.technical}%` : null,
      dims.professional != null ? `professional ${dims.professional}%` : null,
    ];
    if ((role.strengths ?? []).length) pieces.push(`strengths ${role.strengths.map((s) => s.skillName).join(', ')}`);
    if ((role.criticalGaps ?? []).length) pieces.push(`critical gaps ${role.criticalGaps.map((g) => g.skillName).join(', ')}`);
    if ((role.mediumGaps ?? []).length) pieces.push(`medium gaps ${role.mediumGaps.map((g) => g.skillName).join(', ')}`);
    if (role.nextBestAction) pieces.push(`next best action ${role.nextBestAction.action}`);
    docs.push({ source: 'readiness', label: role.roleName, text: pieces.filter(Boolean).join(' ') });
  }

  const roadmaps = await Roadmap.find({ userId }).lean();
  for (const roadmap of roadmaps) {
    for (const task of roadmap.tasks ?? []) {
      if (task.status === 'done') continue;
      docs.push({
        source: 'roadmap',
        label: `${roadmap.roleName} task`,
        text: `${task.skillName}: ${task.action}. ${task.reason ?? ''} impact ${task.impact ?? '?'} effort ${task.effortEstimate ?? '?'}`,
      });
    }
  }

  const projects = await Project.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
  for (const p of projects) {
    const skillNames = (p.skillsUsed ?? []).map((s) => s.skillSlug ?? s.skillId).join(', ');
    docs.push({
      source: 'project',
      label: p.title,
      text: `${p.title}: ${p.description ?? ''} tech ${(p.techStack ?? []).join(', ')} skills ${skillNames}`,
    });
  }

  for (const role of readinessSummary?.roles ?? []) {
    if (role.marketExplanation) {
      docs.push({ source: 'market', label: `${role.roleName} market`, text: `${role.roleName} market: ${role.marketExplanation}` });
    }
  }

  return docs;
}

function retrieveContext(userQuery, docs, { topK = 6, minScore = 0.02 } = {}) {
  const queryTokens = tokenize(userQuery);
  if (queryTokens.length === 0 || docs.length === 0) return null;

  const scored = docs
    .map((doc) => ({ doc, score: scoreChunk(queryTokens, tokenize(doc.text)) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length === 0) return null;

  const lines = scored.map(({ doc, score }) => {
    const meta = doc.label ? `${doc.source}:${doc.label}` : doc.source;
    return `- [${meta}] ${doc.text} (relevance ${(score * 100).toFixed(0)}%)`;
  });
  return `RETRIEVED NOTES (ranked by relevance to the conversation):\n${lines.join('\n')}`;
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
    return null;
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
  return data.choices?.[0]?.message?.content ?? null;
}

// --- Offline answer engine ------------------------------------------------
// Produces a useful, data-grounded reply without calling an external LLM.
// Uses the same RAG context the prompt builder would feed a model.

const INTENT_KEYWORDS = {
  readiness: ['ready', 'readiness', 'score', 'overall', 'resume', 'hire', 'job ready', 'prepared'],
  gaps: ['gap', 'missing', 'weak', 'improve', 'lacking', 'short', 'need to learn', 'biggest'],
  strengths: ['strength', 'good at', 'proficient', 'strong in', 'best at'],
  evidence: ['evidence', 'proof', 'validate', 'prove', 'proven', 'portfolio', 'project', 'github'],
  plan: ['plan', 'next step', 'roadmap', 'what should i do', 'action', 'steps', 'sequence', 'first'],
  market: ['market', 'demand', 'salary', 'trend', 'hiring', 'job search', 'industry'],
  assessment: ['assessment', 'practice', 'test', 'exam', 'mock', 'interview'],
  compare: ['compare', 'vs', 'versus', 'which role', 'which career', 'decide'],
  greeting: ['hi', 'hello', 'hey', 'namaste', 'greetings'],
};

function stem(tok) {
  if (tok.length <= 3) return tok;
  if (tok.endsWith('ies') && tok.length > 4) return `${tok.slice(0, -3)}y`;
  if (tok.endsWith('ing') && tok.length > 5) return tok.slice(0, -3);
  if (tok.endsWith('es') && tok.length > 4) return tok.slice(0, -2);
  if (tok.endsWith('s') ) return tok.slice(0, -1);
  return tok;
}

function detectIntent(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 'general';
  const tokenStems = new Set(tokens.map(stem));
  let best = 'general';
  let bestScore = 0;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const hits = keywords.filter((k) => {
      const kt = tokenize(k);
      return kt.length > 0 && kt.every((t) => tokenStems.has(stem(t)));
    }).length;
    const score = hits / Math.sqrt(keywords.length);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : 'general';
}

function intentReply(intent, contexts, userMessage) {
  const { readinessSummary, evidenceHighlights, marketInsights, targetRoleIds } = contexts;
  const roles = readinessSummary?.roles ?? [];
  const primary = roles[0];
  const lines = [];

  if (intent === 'greeting') {
    lines.push(
      `Hi! I'm your Career Intelligence Coach${targetRoleIds.length ? ` — I can see you're tracking ${roles.map((r) => r.roleName).join(', ')}` : ''}.`,
      ``,
      `Ask me about your readiness, your skill gaps, what evidence would strengthen your profile, or what to work on next.`,
    );
    return lines.join('\n');
  }

  if (intent === 'readiness') {
    if (!primary) {
      lines.push('You have not selected a target role yet, so I have no readiness estimate to report.');
      lines.push('Head to "Target roles" in the sidebar, pick the role you are aiming for, then come back and ask me again.');
    } else {
      lines.push(`Here is your readiness picture for ${primary.roleName}:`);
      const dims = primary.dimensions ?? {};
      lines.push(`- Overall: ${primary.overall ?? 'N/A'}%`);
      if (dims.technical != null) lines.push(`- Technical: ${dims.technical}%`);
      if (dims.professional != null) lines.push(`- Professional: ${dims.professional}%`);
      if (dims.marketAlignment != null) lines.push(`- Market alignment: ${dims.marketAlignment}%`);
      if (dims.evidenceConfidence != null) lines.push(`- Evidence confidence: ${dims.evidenceConfidence}%`);
      if (primary.nextBestAction) {
        lines.push('');
        lines.push(`Recommended next step: ${primary.nextBestAction.action}`);
        lines.push(primary.nextBestAction.reason ?? '');
      }
    }
  } else if (intent === 'gaps') {
    if (!primary) {
      lines.push('I need a target role before I can identify meaningful gaps. Select one under "Target roles", then ask me again.');
    } else {
      const critical = primary.criticalGaps ?? [];
      if (critical.length === 0) {
        lines.push(`Good news: ${primary.roleName} has no critical gaps right now.`);
      } else {
        lines.push(`Your critical gaps for ${primary.roleName}:`);
        for (const g of critical) lines.push(`- ${g.skillName}`);
        lines.push('');
        if (primary.nextBestAction) lines.push(`Work on: ${primary.nextBestAction.action}`);
      }
      const medium = primary.mediumGaps ?? [];
      if (medium.length) {
        lines.push('');
        lines.push(`Medium gaps worth addressing: ${medium.map((g) => g.skillName).join(', ')}`);
      }
      const missing = primary.missingEvidence ?? [];
      if (missing.length) {
        lines.push('');
        lines.push(`Skills without any recorded evidence yet: ${missing.map((m) => m.skillName).join(', ')}`);
        lines.push('Adding evidence for these matters more than self-reporting them.');
      }
    }
  } else if (intent === 'strengths') {
    if (!primary) {
      lines.push('Pick a target role first so I can tell you which skills you are strongest in.');
    } else {
      const strengths = primary.strengths ?? [];
      lines.push(
        strengths.length
          ? `Your strongest skills for ${primary.roleName}: ${strengths.map((s) => s.skillName).join(', ')}`
          : `You do not have proven strengths for ${primary.roleName} yet — no skill has enough validated evidence.`,
      );
      if (evidenceHighlights.length) {
        lines.push('');
        lines.push(`Highest-confidence evidence: ${evidenceHighlights[0].skillName} (${evidenceHighlights[0].confidenceScore}%)`);
      }
    }
  } else if (intent === 'evidence') {
    if (evidenceHighlights.length === 0) {
      lines.push('You have no validated evidence on record yet.');
      lines.push('Try graded assessments, real projects, deployable apps, or concrete GitHub work. Evidence, not self-claims, drives your readiness score.');
    } else {
      lines.push(`You have ${evidenceHighlights.length} skills with recorded evidence:`);
      for (const e of evidenceHighlights) {
        lines.push(`- ${e.skillName}: confidence ${e.confidenceScore}% (${e.sources?.length ?? 0} sources)`);
      }
      lines.push('');
      lines.push(`Tip: ${(readinessSummary?.roles?.[0]?.missingEvidence ?? []).length ? 'the skills listed in "missing evidence" have claims but no proof, so weighted evidence first.' : 'keep grading assessments and building deployed projects to lift confidence.'}`);
    }
  } else if (intent === 'plan') {
    if (!primary) {
      lines.push('To build a plan I need a target role. Choose one under "Target roles" and I will outline steps.');
    } else {
      lines.push(`Here is a practical plan for ${primary.roleName}:`);
      lines.push(`1. Close your biggest gap first: ${(primary.criticalGaps?.[0]?.skillName) ?? (primary.missingEvidence?.[0]?.skillName) ?? 'pick a skill with no evidence'}.`);
      lines.push(`2. ${primary.nextBestAction?.action ?? 'Complete a graded assessment for your weakest skill'} — ${primary.nextBestAction?.reason ?? 'it is the highest-impact move.'}`);
      lines.push('3. Record evidence as you go (assessments, projects, GitHub) so your score reflects reality.');
      lines.push('4. Re-check your roadmap after each completed task and refresh your readiness estimate.');
    }
  } else if (intent === 'market') {
    const data = marketInsights?.length ? marketInsights : [];
    if (data.length === 0) {
      lines.push('I have limited market data for your target role. You can import job postings in the Market page to unlock demand signals.');
    } else {
      lines.push('Here is what the market data shows:');
      for (const m of data) {
        lines.push(`- ${m.roleName}: demand ${m.demandLabel}`);
        if (m.topSkills?.length) lines.push(`  top skills in demand: ${m.topSkills.join(', ')}`);
      }
    }
  } else if (intent === 'assessment') {
    lines.push('Strong evidence for a skill = scored, verifiable assessment. Good options:');
    lines.push('- Take skill-specific assessments here (Assessments page)');
    lines.push('- Solve and submit DSA/coding problems with clear records.');
    lines.push('- Do a mock interview to validate professional skills.');
  } else if (intent === 'compare') {
    if (roles.length < 2) {
      lines.push('You need at least two target roles to compare. Add another one under "Target roles", then ask me again.');
    } else {
      lines.push(`Here is how your tracked roles compare by readiness:`);
      for (const role of roles) {
        lines.push(`- ${role.roleName}: ${role.overall ?? 'N/A'}% overall (technical ${role.dimensions?.technical ?? 'N/A'}%, professional ${role.dimensions?.professional ?? 'N/A'}%)`);
      }
      const best = roles.reduce((a, b) => ((b.overall ?? 0) > (a.overall ?? 0) ? b : a), roles[0]);
      lines.push('');
      lines.push(`You are currently most ready for ${best.roleName}.`);
    }
  } else {
    lines.push("I can help with career readiness. I don't have an answer to that specific question without my AI model connected, but I can tell you about:");
    lines.push('- Your readiness score and what it means');
    lines.push('- Critical skill gaps and how to close them');
    lines.push('- What evidence to add to strengthen your profile');
    lines.push('- Market demand signals for your target role');
    lines.push('- A concrete next-step plan');
    lines.push('');
    lines.push('Try asking: "What are my biggest gaps?" or "What should I work on next?"');
  }

  if (intent !== 'greeting' && retrievedSection(contexts)) {
    lines.push('');
    lines.push(retrievedSection(contexts));
  }

  return lines.join('\n');
}

function retrievedSection(contexts) {
  const docs = contexts._retrieved?.docs;
  if (!docs?.length) return null;
  const top = docs[0];
  return `[Based on your records] ${top.text}`;
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
  let contextBlock = buildContextBlock(
    context.readinessSummary,
    context.evidenceHighlights,
    context.marketInsights,
  );

  // Retrieval layer: score the user's message against the user's own domain
  // documents (evidence, readiness, roadmap tasks, projects, market notes) and
  // inject the most relevant ones so the coach answers from concrete data.
  const docs = await buildDomainDocuments(userId, context.readinessSummary, context.skillNameMap);
  const retrieved = retrieveContext(content, docs);
  if (retrieved) {
    contextBlock += `\n\n${retrieved}`;
  }
  context._retrieved = retrieved ? { docs: docs.slice(0, 6) } : null;

  // Get conversation history (last 20 messages for context window)
  const history = await Message.find({ conversationId: conv._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  history.reverse();

  const llmMessages = buildMessages(history, content, contextBlock);
  const llmReply = await callLLM(llmMessages);
  const reply = llmReply ?? intentReply(detectIntent(content), context, content);

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
      retrievedNotes: retrieved ?? null,
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
