import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { cn } from '../../lib/utils.js';

function ReadinessBadge({ score }) {
  if (score == null) return <span className="text-xs text-slate-400">N/A</span>;
  const cls =
    score >= 70 ? 'bg-green-100 text-green-700' :
    score >= 40 ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {score}%
    </span>
  );
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    Promise.all([
      apiFetch('/recruiter/candidates'),
      apiFetch('/roles'),
    ]).then(([cands, rl]) => {
      setCandidates(cands);
      setRoles(rl.roles ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter) params.set('roleId', roleFilter);
    if (skillFilter) params.set('skill', skillFilter);
    apiFetch(`/recruiter/candidates?${params}`)
      .then(setCandidates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roleFilter, skillFilter]);

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse student candidates, inspect their readiness, and add them to shortlists.
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Filter by role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Filter by skill</label>
              <Input
                placeholder="e.g. React"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
          <Link
            to={`/dashboard/candidates/compare?ids=${selected.join(',')}`}
            className="text-sm text-indigo-600 hover:underline disabled:pointer-events-none disabled:opacity-50"
            aria-disabled={selected.length < 2}
          >
            Compare {selected.length || 0} candidate{selected.length === 1 ? '' : 's'} →
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading candidates…</p>
        ) : candidates.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-sm text-slate-500">No candidates found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => (
              <Card key={c.userId} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{c.displayName}</CardTitle>
                      {c.headline && (
                        <p className="text-xs text-slate-500 mt-0.5">{c.headline}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <ReadinessBadge score={c.readinessScore} />
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.userId)}
                          onChange={() => toggle(c.userId)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                        />
                        Compare
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {c.targetRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.targetRoles.map((r) => (
                        <span key={r.roleId} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                          {r.roleName}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.topSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.topSkills.map((s) => (
                        <span key={s.skillName} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {s.skillName}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">{c.evidenceCount} evidence item{c.evidenceCount === 1 ? '' : 's'}</span>
                    <Link to={`/dashboard/candidates/${c.userId}`} className="text-xs text-indigo-600 hover:underline">
                      View profile →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
