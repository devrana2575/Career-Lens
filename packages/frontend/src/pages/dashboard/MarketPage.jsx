import { useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const DEMAND_STYLES = {
  rising: 'bg-emerald-100 text-emerald-700',
  stable: 'bg-amber-100 text-amber-700',
  declining: 'bg-rose-100 text-rose-700',
  insufficient: 'bg-slate-100 text-slate-600',
};

const CONFIDENCE_STYLES = {
  sufficient: 'bg-indigo-100 text-indigo-700',
  insufficient: 'bg-slate-100 text-slate-500',
};

function Badge({ children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  );
}

export default function MarketPage() {
  const [overview, setOverview] = useState(null);
  const [benchmarks, setBenchmarks] = useState([]);
  const [trends, setTrends] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/market/overview'),
      apiFetch('/market/benchmarks'),
      apiFetch('/market/skills/trends'),
    ])
      .then(([ov, benches, skillTrends]) => {
        setOverview(ov);
        setBenchmarks(benches);
        setTrends(skillTrends);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading market intelligence…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Market intelligence</h1>
            <p className="mt-1 text-sm text-slate-500">
              Demand benchmarks and skill trends computed from collected job postings.
            </p>
          </div>
          {overview?.demoData && <Badge className="bg-violet-100 text-violet-700">DEMO DATA</Badge>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {overview && overview.totalSnapshots > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Snapshot</CardTitle>
              <CardDescription>As of {overview.asOfDate}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Latest job posts</p>
                <p className="text-lg font-semibold text-slate-900">{overview.totalJobs}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Roles covered</p>
                <p className="text-lg font-semibold text-slate-900">{overview.rolesCovered}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Locations</p>
                <p className="text-lg font-semibold text-slate-900">{overview.locations.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Sources</p>
                <p className="truncate text-lg font-semibold text-slate-900">
                  {overview.sources.join(', ') || '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-semibold text-slate-900">Role demand</h2>
          <p className="mt-1 text-sm text-slate-500">
            Volumes and top skills per role at the latest snapshot. High-volume roles carry sufficient confidence.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {benchmarks.length === 0 && (
              <Card>
                <CardContent className="text-sm text-slate-500">
                  No role snapshots yet. Operators can run the market build pipeline to produce them.
                </CardContent>
              </Card>
            )}
            {benchmarks.map((b) => (
              <Card key={b.roleId}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{b.roleName}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Badge className={DEMAND_STYLES[b.demand] ?? DEMAND_STYLES.insufficient}>
                        {b.demand}
                      </Badge>
                      <Badge className={CONFIDENCE_STYLES[b.confidence]}>
                        {b.confidence}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {b.jobVolume} open posts · {b.dataVolume}
                    {b.snapshotDate ? ` · as of ${b.snapshotDate}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>
                      Exp. <span className="font-medium text-slate-900">{b.experienceYears.avg ?? '—'}</span> yr avg
                    </span>
                    <span>
                      Range{' '}
                      <span className="font-medium text-slate-900">
                        {b.experienceYears.min ?? '—'}–{b.experienceYears.max ?? '—'}
                      </span>
                    </span>
                  </div>

                  {b.topSkills.length > 0 && (
                    <div className="space-y-2">
                      {b.topSkills.slice(0, 5).map((s) => (
                        <div key={s.skillId} className="flex items-center gap-3">
                          <span className="w-32 shrink-0 truncate text-xs text-slate-600">{s.skillName}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.round((s.share ?? 0) * 100)}%` }}
                            />
                          </div>
                          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-500">
                            {s.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {b.locations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {b.locations.map((l) => (
                        <span key={l.location} className="text-xs text-slate-500">
                          {l.location} ({l.jobCount})
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">Skill demand trends</h2>
          <p className="mt-1 text-sm text-slate-500">
            How often each skill appears across recent postings, per snapshot date.
          </p>
          <Card className="mt-4">
            <CardContent className="p-0">
              {trends.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No skill trends yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Skill</th>
                      <th className="px-4 py-3 font-medium">Trend</th>
                      <th className="px-4 py-3 font-medium">Latest share</th>
                      <th className="px-4 py-3 font-medium">Series</th>
                      <th className="px-4 py-3 font-medium">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trends.map((t) => (
                      <tr key={t.skillId}>
                        <td className="px-4 py-3 font-medium text-slate-800">{t.skillName}</td>
                        <td className="px-4 py-3">
                          <Badge className={DEMAND_STYLES[t.trend] ?? DEMAND_STYLES.insufficient}>
                            {t.trend}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {t.latestShare == null ? '—' : `${Math.round(t.latestShare * 100)}%`}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {t.series.map((s) => (
                              <div
                                key={s.snapshotDate}
                                className="w-1.5 rounded-full bg-indigo-400"
                                style={{ height: `${Math.max(4, Math.round(s.share * 100))}px` }}
                                title={`${s.snapshotDate}: ${Math.round(s.share * 100)}%`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{t.dataVolume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}