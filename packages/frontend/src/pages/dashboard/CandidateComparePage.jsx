import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const BUCKET_STYLES = {
  strength: 'bg-green-100 text-green-700',
  'critical gap': 'bg-red-100 text-red-700',
  gap: 'bg-amber-100 text-amber-700',
  'no evidence': 'bg-slate-100 text-slate-500',
};

function buildSkillMap(candidate) {
  const map = new Map();
  for (const report of candidate.readinessReports ?? []) {
    const buckets = {
      strength: report.strengths ?? [],
      'critical gap': report.criticalGaps ?? [],
      gap: report.mediumGaps ?? report.optionalGaps ?? [],
      'no evidence': report.missingEvidence ?? [],
    };
    for (const [bucket, items] of Object.entries(buckets)) {
      for (const s of items) {
        const existing = map.get(s.skillName);
        if (!existing || bucket === 'strength') {
          map.set(s.skillName, { skillName: s.skillName, bucket, proficiency: s.proficiency });
        }
      }
    }
  }
  return map;
}

export default function CandidateComparePage() {
  const [params] = useSearchParams();
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const ids = useMemo(
    () => (params.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    [params],
  );

  useEffect(() => {
    if (ids.length < 2) {
      setError('Select at least 2 candidates to compare.');
      setLoading(false);
      return;
    }
    apiFetch('/recruiter/candidates/compare', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ids }),
    })
      .then((data) => setResults(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ids]);

  const skillMap = useMemo(() => {
    const map = new Map();
    for (const c of results?.candidates ?? []) {
      for (const [skillName, cell] of buildSkillMap(c)) {
        if (!map.has(skillName)) map.set(skillName, { skillName, cells: {} });
        map.get(skillName).cells[c.userId] = cell;
      }
    }
    return [...map.values()].sort((a, b) => a.skillName.localeCompare(b.skillName));
  }, [results]);

  return (
    <Layout>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Compare candidates</h1>
            <p className="mt-1 text-sm text-slate-500">Skill coverage across the selected applicants.</p>
          </div>
          <Link to="/dashboard/candidates" className="text-sm text-indigo-600 hover:underline">
            ← Back to candidates
          </Link>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Comparing…</p>}

        {results?.candidates?.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.candidates.map((c) => (
                <Card key={c.userId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{c.displayName}</CardTitle>
                    {c.headline && <p className="text-xs text-slate-500">{c.headline}</p>}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex flex-wrap gap-4">
                      <Metric label="Readiness" value={c.readinessScore != null ? `${c.readinessScore}%` : '—'} />
                      <Metric label="Technical" value={c.technicalReadiness != null ? `${c.technicalReadiness}%` : '—'} />
                      <Metric label="Professional" value={c.professionalReadiness != null ? `${c.professionalReadiness}%` : '—'} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Target roles</p>
                      <p className="text-xs text-slate-700 mt-0.5">
                        {(c.talentProfile ?? []).map((t) => t.roleName).join(', ') || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Recent evidence</p>
                      <p className="text-xs text-slate-700 mt-0.5">
                        {c.recentEvidence?.length
                          ? c.recentEvidence
                              .slice(0, 3)
                              .map((e) => e.skillName)
                              .join(', ')
                          : 'None yet'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Skill coverage matrix</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-2 font-medium text-slate-500">Skill</th>
                      {results.candidates.map((c) => (
                        <th key={c.userId} className="px-2 py-2 font-medium text-slate-500">
                          {c.displayName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {skillMap.map((row) => (
                      <tr key={row.skillName} className="border-b border-slate-100">
                        <td className="px-2 py-1.5 font-medium text-slate-800">{row.skillName}</td>
                        {results.candidates.map((c) => {
                          const cell = row.cells[c.userId];
                          if (!cell) return <td key={c.userId} className="px-2 py-1.5 text-slate-300">—</td>;
                          return (
                            <td key={c.userId} className="px-2 py-1.5">
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', BUCKET_STYLES[cell.bucket] ?? BUCKET_STYLES['no evidence'])}>
                                {cell.bucket}
                                {cell.proficiency != null ? ` · ${cell.proficiency}%` : ''}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}