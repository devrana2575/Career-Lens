import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth-context.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const REVIEWER_ROLES = ['admin', 'mentor'];

export default function ReviewsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const { attempts } = await apiFetch('/assessments/attempts/pending');
    setItems(attempts);
  }, []);

  useEffect(() => {
    if (REVIEWER_ROLES.includes(user?.role)) {
      refresh().catch((err) => setError(err.message)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh, user]);

  const active = items.find((a) => a.id === activeId) ?? null;

  function open(item) {
    setActiveId(item.id);
    setError('');
    setSuccess('');
    const nextScores = {};
    for (const q of item.questions) {
      nextScores[q.id] = {};
      for (const c of q.rubric ?? []) nextScores[q.id][c.id] = 0;
    }
    setScores(nextScores);
    setComments({});
  }

  function setCriterionScore(questionId, criterionId, value) {
    const raw = Number(value);
    const points = Number.isFinite(raw) && raw >= 0 ? Math.min(Math.floor(raw), 999) : 0;
    setScores((prev) => ({ ...prev, [questionId]: { ...prev[questionId], [criterionId]: points } }));
  }

  function questionSum(q) {
    const qs = scores[q.id] ?? {};
    return (q.rubric ?? []).reduce((sum, c) => sum + (qs[c.id] ?? 0), 0);
  }

  function validate() {
    if (!active) return null;
    for (const q of active.questions) {
      const qs = scores[q.id] ?? {};
      for (const c of q.rubric ?? []) {
        const s = qs[c.id] ?? 0;
        if (s < 0 || s > c.maxPoints) return `Criterion "${c.label}" exceeds its ${c.maxPoints}pt max.`;
      }
      if (questionSum(q) > q.points) {
        return `"${q.prompt.slice(0, 40)}…" sums above its ${q.points}pt max.`;
      }
    }
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const review = active.questions.map((q) => ({
        questionId: q.id,
        scores: (q.rubric ?? []).map((c) => ({ criterionId: c.id, points: scores[q.id]?.[c.id] ?? 0 })),
        comment: comments[q.id]?.trim() || undefined,
      }));
      await apiFetch(`/assessments/attempts/${active.id}/review`, {
        method: 'POST',
        body: { review },
      });
      setSuccess(`Reviewed "${active.student.displayName}"'s attempt (${active.assessmentTitle}). Score is now evidence.`);
      setActiveId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
          <p className="mt-1 text-sm text-slate-500">
            Score submitted case studies against their published rubrics. Once scored, the attempt becomes
            immutable evidence for the student.
          </p>
        </div>

        {!REVIEWER_ROLES.includes(user?.role) ? (
          <Card>
            <CardContent className="text-sm text-slate-500">
              Only admins and mentors can review assessments.
            </CardContent>
          </Card>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            {loading ? (
              <Card>
                <CardContent className="text-sm text-slate-500">Loading…</CardContent>
              </Card>
            ) : active ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {active.assessmentTitle} — {active.student.displayName}
                  </CardTitle>
                  <CardDescription>
                    Submitted {new Date(active.submittedAt).toLocaleString()} · {active.questions.length} questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {active.questions.map((q, qIndex) => {
                    const sum = questionSum(q);
                    return (
                      <div key={q.id} className="rounded-md border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-slate-800">
                            <span className="mr-2 text-slate-400">{qIndex + 1}.</span>
                            {q.prompt}
                          </p>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                              sum <= q.points ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700',
                            )}
                          >
                            {sum}/{q.points} pts
                          </span>
                        </div>

                        <pre className="mt-3 max-h-60 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs text-slate-100">
                          {q.submission?.text ?? '(no text submitted)'}
                        </pre>

                        <div className="mt-4 space-y-2">
                          {(q.rubric ?? []).map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700">{c.label}</p>
                                <p className="text-xs text-slate-500">{c.description}</p>
                              </div>
                              <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
                                <span className="text-xs">{c.maxPoints} max</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={c.maxPoints}
                                  value={scores[q.id]?.[c.id] ?? 0}
                                  onChange={(e) => setCriterionScore(q.id, c.id, e.target.value)}
                                  className="h-9 w-20"
                                />
                              </label>
                            </div>
                          ))}
                        </div>

                        <input
                          value={comments[q.id] ?? ''}
                          onChange={(e) => setComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Optional comment for this answer…"
                          className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Saving review…' : 'Publish review & record evidence'}
                    </Button>
                    <button
                      onClick={() => setActiveId(null)}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Back to queue
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="text-sm text-slate-500">
                  No assessments waiting for review.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {items.map((a) => (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{a.assessmentTitle}</CardTitle>
                      <CardDescription>
                        {a.student.displayName} · submitted {new Date(a.submittedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        {a.questions.length} questions · {a.maxScore} pts max
                      </p>
                      <Button onClick={() => open(a)} size="sm">
                        Review
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}