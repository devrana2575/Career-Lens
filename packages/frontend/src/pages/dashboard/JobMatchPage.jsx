import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const STRENGTH_CLASS = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function fitTone(fit) {
  if (fit >= 75) return 'bg-green-100 text-green-700';
  if (fit >= 50) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

function ScoreBar({ label, value, tone = 'bg-indigo-500' }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-500">{label}</span>
        <span className="font-semibold text-slate-800">{value}/100</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function MatchCard({ match, onApply, applying }) {
  const [applied, setApplied] = useState(false);
  const location = match.location ? `${match.location} · ` : '';
  const extra = [match.experienceYears ? `${match.experienceYears}+ yrs` : null]
    .filter(Boolean)
    .join(' · ');

  function handleApply() {
    setApplied(true);
    onApply(match.jobId).catch(() => setApplied(false));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">{match.title}</CardTitle>
          <CardDescription>
            {[match.company, location, extra].filter(Boolean).join(' · ') || '—'}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
              fitTone(match.fitScore),
            )}
          >
            {match.fitScore}% fit
          </span>
          <Button
            size="sm"
            variant={applied ? 'outline' : 'default'}
            disabled={applied || applying}
            onClick={handleApply}
          >
            {applied ? 'Applied' : 'Apply'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <ScoreBar label="Fit" value={match.fitScore} tone={fitTone(match.fitScore)} />
          <ScoreBar label="Skill coverage" value={match.skillCoverage} />
          <ScoreBar label="Text similarity" value={match.textSimilarity} tone="bg-sky-500" />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">Matched skills</span>
            {match.matchedSkills.length === 0 ? (
              <span className="text-xs text-slate-400">none</span>
            ) : (
              match.matchedSkills.map((skill) => (
                <span
                  key={skill.skillId}
                  className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700"
                >
                  {skill.name}
                  <span
                    className={cn(
                      'rounded px-1 text-[10px] font-medium',
                      STRENGTH_CLASS[skill.strength] ?? STRENGTH_CLASS.low,
                    )}
                  >
                    {skill.strength}
                  </span>
                </span>
              ))
            )}
          </div>
          {match.missingSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-400">Missing skills</span>
              {match.missingSkills.map((skill) => (
                <span
                  key={skill.skillId}
                  className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <ul className="space-y-1 text-xs text-slate-600">
          {match.insights.map((insight, index) => (
            <li key={index} className="flex gap-1.5">
              <span className="text-slate-400">•</span>
              {insight}
            </li>
          ))}
        </ul>

        {match.recommendations.length > 0 && (
          <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            <span className="font-medium">To improve this match: </span>
            {match.recommendations.join(' ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobMatchPage() {
  const location = useLocation();
  const initialText = useMemo(() => location.state?.text ?? '', [location.state]);
  const [text, setText] = useState(initialText);
  const [matching, setMatching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const MAX_SIZE_MB = 2;
    const ALLOWED_EXTENSIONS = ['.txt', '.md', '.text', '.markdown'];
    const dotIndex = file.name.lastIndexOf('.');
    const ext = dotIndex > 0 ? file.name.slice(dotIndex).toLowerCase() : '';
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_SIZE_MB} MB — upload a smaller plain-text resume.`);
      return;
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Only .txt, .md, .text, or .markdown files are accepted.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      if (content.includes('\u0000')) {
        setError('That file appears to be binary — save it as plain text (.txt / .md) and retry.');
        return;
      }
      setText(content);
    };
    reader.onerror = () => setError('Could not read that file — save it as plain text (.txt / .md) and retry.');
    reader.readAsText(file);
  }

  async function handleMatch() {
    setMatching(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch('/jobs/match', {
        method: 'POST',
        body: { text },
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  }

  async function handleApply(jobId) {
    setApplying(true);
    try {
      await apiFetch('/applications', { method: 'POST', body: { jobId } });
    } finally {
      setApplying(false);
    }
  }

  const ready = text.trim().length > 0 && !matching;

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Job matches</h1>
          <p className="mt-1 text-sm text-slate-500">
            Paste your resume to score active postings. Fit combines how many recognized skills in
            each posting your resume presents with how closely the descriptions match.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Find matching jobs</CardTitle>
            <CardDescription>
              Every score carries its reason: which posting skills you already cover, text
              similarity, and the specific gaps to close.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="match-file">
                File
              </label>
              <input
                id="match-file"
                type="file"
                accept=".txt,.md,.text,.markdown"
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={handleFile}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="match-text">
                Resume text
              </label>
              <textarea
                id="match-text"
                rows={8}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste the resume content here…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="button" onClick={handleMatch} disabled={!ready}>
              {matching ? 'Matching…' : 'Match jobs'}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {result.summary.jobsEvaluated} job{result.summary.jobsEvaluated === 1 ? '' : 's'} evaluated
                </CardTitle>
                <CardDescription>
                  {result.matches.length} ranked by fit ·{' '}
                  {result.summary.bestFit != null
                    ? `best match ${result.summary.bestFit}% — ${result.summary.bestJob?.title ?? '—'}`
                    : 'no matches yet'}{' '}
                  · {result.candidate.detectedSkills} skill{result.candidate.detectedSkills === 1 ? '' : 's'} found on
                  your resume
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              {result.matches.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-slate-500">
                    No postings to match against right now. Try again once jobs are available.
                  </CardContent>
                </Card>
              ) : (
                result.matches.map((match) => (
                  <MatchCard
                    key={match.jobId}
                    match={match}
                    onApply={handleApply}
                    applying={applying}
                  />
                ))
              )}
            </div>

            {result.note && (
              <p className="pt-2 text-xs italic text-slate-400">{result.note}</p>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}