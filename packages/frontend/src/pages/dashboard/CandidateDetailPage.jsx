import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

function ReadinessBar({ label, value }) {
  if (value == null) return null;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full rounded-full',
            value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-400',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function GapList({ items, label }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</h4>
      <ul className="space-y-1">
        {items.map((g) => (
          <li key={g.skillId} className="flex items-center justify-between text-xs text-slate-700">
            <span>{g.skillName}</span>
            <span className="text-slate-400">{g.proficiency ?? '—'}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/recruiter/candidates/${id}`)
      .then(setCandidate)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading candidate…</p>
      </Layout>
    );
  }

  if (error || !candidate) {
    return (
      <Layout>
        <p className="text-sm text-red-600">{error || 'Candidate not found.'}</p>
        <Link to="/dashboard/candidates" className="text-sm text-indigo-600 hover:underline mt-2 block">
          ← Back to candidates
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <Link to="/dashboard/candidates" className="text-sm text-indigo-600 hover:underline">
            ← Back to candidates
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">{candidate.displayName}</h1>
          {candidate.headline && <p className="text-sm text-slate-500">{candidate.headline}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {candidate.email && <div><span className="text-slate-500">Email:</span> {candidate.email}</div>}
              {candidate.location && <div><span className="text-slate-500">Location:</span> {candidate.location}</div>}
              {candidate.yearsOfExperience != null && <div><span className="text-slate-500">Experience:</span> {candidate.yearsOfExperience} years</div>}
              {candidate.githubUsername && (
                <div>
                  <span className="text-slate-500">GitHub:</span>{' '}
                  <a href={`https://github.com/${candidate.githubUsername}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {candidate.githubUsername}
                  </a>
                </div>
              )}
              {candidate.bio && <p className="text-slate-600 mt-2">{candidate.bio}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Target Roles</CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.targetRoles.length === 0 ? (
                <p className="text-xs text-slate-400">No target roles set.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {candidate.targetRoles.map((r) => (
                    <span key={r.roleId} className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                      {r.roleName}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {candidate.readinessReports && candidate.readinessReports.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {candidate.readinessReports.map((r) => (
                <div key={r.roleId} className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-800">{r.roleName}</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ReadinessBar label="Technical" value={r.dimensions?.technical} />
                    <ReadinessBar label="Professional" value={r.dimensions?.professional} />
                    <ReadinessBar label="Market alignment" value={r.dimensions?.marketAlignment} />
                    <ReadinessBar label="Evidence confidence" value={r.dimensions?.evidenceConfidence} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <GapList items={r.strengths} label="Strengths" />
                    <GapList items={r.criticalGaps} label="Critical gaps" />
                    <GapList items={r.mediumGaps} label="Medium gaps" />
                    <GapList items={r.missingEvidence} label="Missing evidence" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {candidate.recentEvidence && candidate.recentEvidence.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {candidate.recentEvidence.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-xs text-slate-700">
                    <span>{e.skillName}</span>
                    <span className="text-slate-400">
                      confidence {e.confidenceScore}% · {e.sources?.length ?? 0} source{(e.sources?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
