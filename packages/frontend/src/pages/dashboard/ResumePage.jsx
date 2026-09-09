import { useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function ResumePage() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch('/resume/analyze', {
        method: 'POST',
        body: { text, ...(fileName ? { fileName } : {}) },
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.onerror = () => setError('Could not read that file — save it as plain text (.txt / .md) and retry.');
    reader.readAsText(file);
  }

  const ready = text.trim().length > 0 && !analyzing;

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Resume</h1>
          <p className="mt-1 text-sm text-slate-500">
            Paste your resume (or upload a .txt / .md file). Matching skills are added to your
            evidence as resume sources — prominence only, never a fabricated score.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analyze resume</CardTitle>
            <CardDescription>
              Detected skills become supporting evidence on your evidence graph. Proficiency still
              comes only from assessed, scored sources.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="resume-file">
                File
              </label>
              <input
                id="resume-file"
                type="file"
                accept=".txt,.md,.text,.markdown"
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={handleFile}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="resume-text">
                Resume text
              </label>
              <textarea
                id="resume-text"
                rows={10}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste the resume content here…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleAnalyze} disabled={!ready}>
                {analyzing ? 'Analyzing…' : 'Analyze resume'}
              </Button>
              <Link to="/dashboard/evidence" className="text-sm text-indigo-600 hover:underline">
                View evidence →
              </Link>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {result.added} skill{result.added === 1 ? '' : 's'} added from resume analysis
              </CardTitle>
              <CardDescription>
                {result.matched} matched · {result.skipped} skipped{result.skipped > 0 ? ' (not in the skill ontology)' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.hits.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No known skills were found in that resume text. Check the spelling or add more
                  detail, then try again.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {result.hits.map((hit) => (
                    <li
                      key={hit.skillId}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-800">{hit.skillName}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{hit.mentions} mention{hit.mentions === 1 ? '' : 's'}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STRENGTH_CLASS[hit.strength] ?? STRENGTH_CLASS.low,
                          )}
                        >
                          {hit.strength}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {result.note && <p className="pt-2 text-xs italic text-slate-400">{result.note}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}