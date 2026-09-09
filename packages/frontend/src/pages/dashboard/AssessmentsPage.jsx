import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const TYPE_LABELS = {
  mcq: 'MCQ',
  coding: 'Coding',
  sql: 'SQL',
  debugging: 'Debugging',
  practical: 'Practical',
  case_study: 'Case study',
  written: 'Written',
  project: 'Project',
};

function ScorePill({ percentScore }) {
  if (percentScore == null) return null;
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        percentScore >= 70 && 'bg-green-100 text-green-700',
        percentScore >= 45 && percentScore < 70 && 'bg-amber-100 text-amber-700',
        percentScore < 45 && 'bg-red-100 text-red-700',
      )}
    >
      {percentScore}%
    </span>
  );
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState([]);
  const [history, setHistory] = useState([]);
  const [runner, setRunner] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [list, attempts] = await Promise.all([
      apiFetch('/assessments'),
      apiFetch('/assessments/attempts'),
    ]);
    setAssessments(list.assessments);
    setHistory(attempts.attempts);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [refresh]);

  async function handleStart(assessmentId) {
    setError('');
    try {
      const { attempt, questions } = await apiFetch(`/assessments/${assessmentId}/start`, {
        method: 'POST',
      });
      setRunner({ attempt, questions });
      setAnswers({});
      setResult(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const answered = runner.questions.filter((q) => answers[q.id] != null);
      const payload = {
        answers: answered.map((q) =>
          q.type === 'mcq'
            ? { questionId: q.id, selectedOptionId: answers[q.id] }
            : { questionId: q.id, text: answers[q.id] },
        ),
      };
      if (payload.answers.length === 0) throw new Error('Answer at least one question before submitting.');
      await apiFetch(`/assessments/attempts/${runner.attempt.id}/submit`, {
        method: 'POST',
        body: payload,
      });
      const detailed = await apiFetch(`/assessments/attempts/${runner.attempt.id}`);
      setResult({ attempt: detailed.attempt, questions: detailed.questions });
      setRunner(null);
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
          <h1 className="text-2xl font-semibold text-slate-900">Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every scored attempt becomes immutable, timestamped evidence for the skill it evaluates.
            Question sets are data — new assessments need no code changes.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {runner ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {runner.questions[0]?.prompt ? 'In progress' : 'Assessment'}
              </CardTitle>
              <CardDescription>
                Answer the questions below, then submit to score and record evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {runner.questions.map((q, index) => (
                <div key={q.id} className="space-y-3">
                  <p className="text-sm font-medium text-slate-800">
                    <span className="mr-2 text-slate-400">{index + 1}.</span>
                    {q.prompt}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {q.points} pt{q.points === 1 ? '' : 's'}
                    </span>
                  </p>
                  {q.type === 'mcq' ? (
                    <div className="space-y-1.5">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                            answers[q.id] === opt.id
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50',
                          )}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt.id}
                            checked={answers[q.id] === opt.id}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                            className="h-3.5 w-3.5 accent-indigo-600"
                          />
                          <span className="text-slate-700">{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={q.type === 'sql' ? 5 : 9}
                      placeholder={q.type === 'sql' ? 'Write your SQL query here…' : 'Write your Python code here…'}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                      spellCheck={false}
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Scoring…' : 'Submit attempt'}
                </Button>
                <button
                  onClick={() => setRunner(null)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        ) : result ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Result for {result.attempt.assessmentTitle}
              </CardTitle>
              <CardDescription>
                Score: {result.attempt.totalScore} / {result.attempt.maxScore}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <ScorePill percentScore={result.attempt.percentScore} />
                <p className="text-sm text-slate-500">
                  This score was recorded as evidence for {result.attempt.skillName}.
                </p>
              </div>
              {result.questions.map((q, index) => {
                const answer = result.attempt.answers.find((a) => a.questionId === q.id);
                const chosen = answer?.selectedOptionId;
                const details = answer?.details ?? null;
                return (
                  <div key={q.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">
                        <span className="mr-2 text-slate-400">{index + 1}.</span>
                        {q.prompt}
                      </p>
                      {q.type !== 'mcq' && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                            answer?.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                          )}
                        >
                          {answer?.isCorrect ? 'Correct' : 'Incorrect'} · {answer?.points ?? 0}/{q.points}
                        </span>
                      )}
                    </div>
                    {q.type === 'mcq' ? (
                      <>
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt) => (
                            <p
                              key={opt.id}
                              className={cn(
                                'rounded px-2 py-1 text-sm',
                                opt.id === q.correctOptionId && 'bg-green-100 text-green-800',
                                opt.id === chosen && opt.id !== q.correctOptionId && 'bg-red-100 text-red-800',
                                opt.id !== chosen && opt.id !== q.correctOptionId && 'text-slate-500',
                              )}
                            >
                              {opt.id}) {opt.text}
                              {opt.id === chosen ? ' — yours' : ''}
                              {opt.id === q.correctOptionId ? ' ✓' : ''}
                            </p>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs text-slate-100">
                          {answer?.text ?? ''}
                        </pre>
                        {details?.error && <p className="mt-2 text-xs text-red-600">{details.error}</p>}
                        {details?.totalCases != null && (
                          <p className="mt-2 text-xs text-slate-600">
                            Passed {details.passedCases} / {details.totalCases} test cases
                            {details.durationMs != null ? ` in ${details.durationMs}ms` : ''}.
                          </p>
                        )}
                        {details?.expectedRowCount != null && (
                          <p className="mt-2 text-xs text-slate-600">
                            Your query returned {details.rowCount} rows (expected {details.expectedRowCount})
                            {details.durationMs != null ? ` in ${details.durationMs}ms` : ''}.
                          </p>
                        )}
                      </>
                    )}
                    <p className="mt-2 text-xs text-slate-500">{q.explanation}</p>
                  </div>
                );
              })}
              <Button onClick={() => setResult(null)} variant="secondary">
                Back to assessments
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Available assessments
              </h2>
              {loading ? (
                <Card>
                  <CardContent className="text-sm text-slate-500">Loading…</CardContent>
                </Card>
              ) : assessments.length === 0 ? (
                <Card>
                  <CardContent className="text-sm text-slate-500">
                    No assessments available yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {assessments.map((a) => (
                    <Card key={a.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base">{a.title}</CardTitle>
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                            {TYPE_LABELS[a.type] ?? a.type}
                          </span>
                        </div>
                        <CardDescription>
                          {a.description ?? ''} · {a.questionCount} questions · {a.timeLimitMinutes} min
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-600">
                          Skill: <span className="font-medium">{a.skillName}</span>
                          {a.roleName ? ` · Role: ${a.roleName}` : ''}
                        </p>
                        <Button onClick={() => handleStart(a.id)}>Start</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your attempts
              </h2>
              {history.length === 0 ? (
                <Card>
                  <CardContent className="text-sm text-slate-500">
                    No attempts yet. Start one above to build evidence for your skills.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {history.map((a) => (
                    <Card key={a.id}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{a.assessmentTitle}</p>
                          <p className="text-xs text-slate-500">
                            {a.skillName} · {new Date(a.startedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {a.status === 'scored' ? (
                            <>
                              <span className="text-sm text-slate-500">
                                {a.totalScore} / {a.maxScore}
                              </span>
                              <ScorePill percentScore={a.percentScore} />
                            </>
                          ) : (
                            <span className="text-xs capitalize text-slate-400">{a.status.replace(/_/g, ' ')}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}