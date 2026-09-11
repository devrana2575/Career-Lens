import { useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const DEMAND_STYLES = {
  rising: 'bg-emerald-100 text-emerald-700',
  stable: 'bg-amber-100 text-amber-700',
  declining: 'bg-rose-100 text-rose-700',
  insufficient: 'bg-slate-100 text-slate-600',
};

const QUALITY_STYLES = {
  validated: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  self_reported: 'bg-indigo-100 text-indigo-600',
  none: 'bg-slate-100 text-slate-500',
};

const BASELINE_STYLES = {
  critical: 'bg-rose-100 text-rose-700',
  required: 'bg-amber-100 text-amber-700',
  preferred: 'bg-indigo-100 text-indigo-600',
  optional: 'bg-slate-100 text-slate-600',
};

function Bar({ value }) {
  if (value == null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <div className="h-1.5 w-16 rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full', value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-400')}
          style={{ width: `${value}%` }}
        />
      </div>
      <span>{value}%</span>
    </div>
  );
}

export default function ComparePage() {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/roles')
      .then((res) => setRoles(res.roles ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const byFamily = new Map();
  for (const role of roles) {
    const list = byFamily.get(role.family ?? 'Other') ?? [];
    list.push(role);
    byFamily.set(role.family ?? 'Other', list);
  }

  function toggle(id) {
    setError('');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return [...next];
    });
  }

  async function doCompare() {
    setComparing(true);
    setError('');
    try {
      const data = await apiFetch(`/comparison/roles?slugs=${selected.join(',')}`);
      setComparison(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading roles…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Compare roles</h1>
          <p className="mt-1 text-sm text-slate-500">
            Select 2–4 roles to compare readiness, market signals, and skill requirements
            side-by-side.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...byFamily.entries()].map(([family, familyRoles]) => (
              <div key={family}>
                <p className="text-xs font-medium text-slate-500 mb-1">{family}</p>
                <div className="flex flex-wrap gap-2">
                  {familyRoles.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm',
                        selected.includes(r.id)
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={doCompare} disabled={selected.length < 2 || comparing}>
              {comparing ? 'Comparing…' : `Compare ${selected.length || ''} roles`}
            </Button>
          </CardContent>
        </Card>

        {comparison?.roles && comparison.roles.length > 0 && <ComparisonResult roles={comparison.roles} />}
      </div>
    </Layout>
  );
}

function ComparisonResult({ roles }) {
  const skillMap = new Map();
  for (const role of roles) {
    for (const skill of role.skills ?? []) {
      if (!skillMap.has(skill.skillId)) {
        skillMap.set(skill.skillId, { ...skill, roles: new Map() });
      }
      skillMap.get(skill.skillId).roles.set(role.id, skill);
    }
  }
  const skillRows = [...skillMap.values()].sort(
    (a, b) => b.baselineLevel.localeCompare(a.baselineLevel) || a.skillName.localeCompare(b.skillName),
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Results</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{role.name}</CardTitle>
                {role.benchmark?.demand && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', DEMAND_STYLES[role.benchmark.demand] ?? DEMAND_STYLES.insufficient)}>
                    {role.benchmark.demand} demand
                  </span>
                )}
              </div>
              {role.family && <p className="text-xs text-slate-500">{role.family}</p>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Technical</p>
                  <Bar value={role.dimensions?.technical} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Professional</p>
                  <Bar value={role.dimensions?.professional} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Market alignment</p>
                  <Bar value={role.dimensions?.marketAlignment} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Evidence confidence</p>
                  <Bar value={role.dimensions?.evidenceConfidence} />
                </div>
              </div>

              {role.benchmark && (
                <div>
                  <p className="text-xs text-slate-500">Top market skills</p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    {(role.benchmark.topSkills ?? []).slice(0, 5).map((s) => s.skillName).join(', ') || '—'}
                  </p>
                </div>
              )}

              {role.strengths?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500">Strengths</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {role.strengths.map((s) => s.skillName).join(', ')}
                  </p>
                </div>
              )}
              {role.criticalGaps?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500">Critical gaps</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {role.criticalGaps.map((g) => g.skillName).join(', ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {skillRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Skill requirements comparison</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 font-medium text-slate-500">Skill</th>
                  <th className="px-2 py-2 font-medium text-slate-500">Level</th>
                  <th className="px-2 py-2 font-medium text-slate-500">Weight</th>
                  {roles.map((role) => (
                    <th key={role.id} className="px-2 py-2 font-medium text-slate-500">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skillRows.map((row) => (
                  <tr key={row.skillId} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 font-medium text-slate-800">{row.skillName}</td>
                    <td className="px-2 py-1.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', BASELINE_STYLES[row.baselineLevel] ?? BASELINE_STYLES.optional)}>
                        {row.baselineLevel}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{row.weight}</td>
                    {roles.map((role) => {
                      const skill = row.roles.get(role.id);
                      if (!skill) return <td key={role.id} className="px-2 py-1.5 text-slate-400">—</td>;
                      return (
                        <td key={role.id} className="px-2 py-1.5 space-y-0.5">
                          <div className="font-medium text-slate-700">{skill.proficiency ?? '—'}%</div>
                          <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', QUALITY_STYLES[skill.quality] ?? QUALITY_STYLES.none)}>
                            {skill.quality.replace('_', ' ')}
                          </span>
                          {skill.marketShare != null && (
                            <span className="ml-1 text-[10px] text-slate-400">{skill.marketShare}% mkt</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}