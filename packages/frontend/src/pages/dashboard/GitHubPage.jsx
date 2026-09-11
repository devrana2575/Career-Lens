import { useState, useEffect } from 'react';
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

const ACTIVITY_CLASS = {
  high: 'text-green-600',
  medium: 'text-amber-600',
  low: 'text-slate-500',
};

export default function GitHubPage() {
  const [username, setUsername] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    apiFetch('/profiles/me').then((p) => {
      if (p.githubUsername) setUsername(p.githubUsername);
    }).catch(() => {});
  }, []);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch('/github/analyze', {
        method: 'POST',
        body: { username },
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const ready = username.trim().length > 0 && !analyzing;

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">GitHub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Analyze your public GitHub profile. Detected skills are added to your evidence as
            GitHub sources — repo count determines strength, never a fabricated proficiency score.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analyze GitHub profile</CardTitle>
            <CardDescription>
              Matching skills become supporting evidence on your evidence graph. Proficiency still
              comes only from assessed, scored sources.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="github-username">
                GitHub username
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="github-username"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. octocat"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Button type="button" onClick={handleAnalyze} disabled={!ready}>
                  {analyzing ? 'Analyzing…' : 'Analyze'}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Link to="/dashboard/evidence" className="text-sm text-indigo-600 hover:underline">
              View evidence →
            </Link>
          </CardContent>
        </Card>

        {result && (
          <>
            {result.stats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">GitHub Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">Public repos</p>
                      <p className="text-lg font-semibold text-slate-900">{result.stats.publicRepos}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total stars</p>
                      <p className="text-lg font-semibold text-slate-900">{result.stats.totalStars}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Activity level</p>
                      <p className={cn('text-lg font-semibold capitalize', ACTIVITY_CLASS[result.stats.activityLevel])}>
                        {result.stats.activityLevel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Top languages</p>
                      <p className="text-sm text-slate-700">
                        {result.stats.topLanguages.length > 0
                          ? result.stats.topLanguages.slice(0, 5).join(', ')
                          : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {result.added} skill{result.added === 1 ? '' : 's'} added from GitHub analysis
                </CardTitle>
                <CardDescription>
                  {result.matched} matched · {result.skipped} skipped{result.skipped > 0 ? ' (not in the skill ontology)' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.hits.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No known skills were detected from your GitHub profile. Make sure your repos have
                    descriptions and use recognized languages or topics.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {result.hits.map((hit) => (
                      <li
                        key={hit.skillId}
                        className="rounded-md border border-slate-200 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-800">{hit.skillName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{hit.repoCount} repo{hit.repoCount === 1 ? '' : 's'}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                                STRENGTH_CLASS[hit.strength] ?? STRENGTH_CLASS.low,
                              )}
                            >
                              {hit.strength}
                            </span>
                          </div>
                        </div>
                        {hit.topRepos && hit.topRepos.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {hit.topRepos.map((repo) => (
                              <a
                                key={repo.name}
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                              >
                                {repo.name}
                                {repo.stars > 0 && (
                                  <span className="text-amber-500">★{repo.stars}</span>
                                )}
                              </a>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {result.note && <p className="pt-2 text-xs italic text-slate-400">{result.note}</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
