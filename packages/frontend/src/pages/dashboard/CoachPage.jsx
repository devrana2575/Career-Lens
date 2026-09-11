import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2 text-sm',
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-100 text-slate-800',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className={cn('mt-1 text-[10px]', isUser ? 'text-indigo-200' : 'text-slate-400')}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function CoachPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
    try {
      const data = await apiFetch('/coach/conversations');
      setConversations(data);
    } catch {
      // ignore
    }
  }

  async function loadConversation(id) {
    setActiveConvId(id);
    setError('');
    try {
      const data = await apiFetch(`/coach/conversations/${id}`);
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }

  function startNew() {
    setActiveConvId(null);
    setMessages([]);
    setError('');
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError('');

    try {
      const body = { content: userMsg.content };
      if (activeConvId) body.conversationId = activeConvId;

      const res = await apiFetch('/coach/messages', { method: 'POST', body });

      const assistantMsg = {
        id: res.messageId,
        role: 'assistant',
        content: res.content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (!activeConvId && res.conversationId) {
        setActiveConvId(res.conversationId);
        await loadConversations();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout>
      <div className="flex gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Sidebar — conversation list */}
        <div className="hidden w-64 flex-shrink-0 flex-col md:flex">
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Conversations</CardTitle>
                <Button variant="ghost" size="sm" onClick={startNew}>
                  + New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <p className="px-2 py-4 text-xs text-slate-400">No conversations yet.</p>
              ) : (
                <ul className="space-y-1">
                  {conversations.map((conv) => (
                    <li key={conv._id || conv.id}>
                      <button
                        onClick={() => loadConversation(conv._id || conv.id)}
                        className={cn(
                          'w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          (conv._id || conv.id) === activeConvId
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {conv.title || 'Untitled conversation'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base">Career Intelligence Coach</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-slate-500">
                      Ask me anything about your career readiness, skill gaps, or next steps.
                    </p>
                    <p className="text-xs text-slate-400">
                      I use your readiness data, evidence, and market intelligence to give personalized advice.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id || msg._id} message={msg} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-500">
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="border-t border-slate-100 p-3">
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your readiness, skills, or next steps…"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={sending}
                />
                <Button type="submit" disabled={!input.trim() || sending}>
                  Send
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
