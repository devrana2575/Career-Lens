import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { cn } from '../../lib/utils.js';

const LEVEL_STYLES = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  required: 'bg-amber-50 text-amber-700 border-amber-200',
  preferred: 'bg-sky-50 text-sky-700 border-sky-200',
  optional: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [roleDetail, setRoleDetail] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/profiles/me')
      .then((p) => {
        setProfile(p);
        const targetId = p.targetRoleIds?.[0];
        if (!targetId) return null;
        return Promise.all([
          apiFetch(`/roles/${targetId}`),
          apiFetch('/readiness').catch(() => null),
        ]).then(([detail, report]) => {
          setRoleDetail(detail);
          setReadiness(report);
          return detail;
        });
      })
      .then((detail) => {
        if (!detail) setRoleDetail(null);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </Layout>
    );
  }

  const hasTargetRole = (profile?.targetRoleIds?.length ?? 0) > 0;
  const requirements = (roleDetail?.requirements ?? []).filter((r) =>
    (roleDetail?.competencies ?? []).some((c) => c.skills.some((s) => s.id === r.skillId)),
  );
  const reqBySkill = new Map(requirements.map((r) => [r.skillId, r]));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Career Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Understand where you are, what is holding you back, and what to do next.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Set up your career profile</CardTitle>
            <CardDescription>
              A few quick steps let us tailor readiness estimates to your target role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${profile?.displayName ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                  {profile ? '✓' : '1'}
                </span>
                Complete your profile
              </li>
              <li className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${hasTargetRole ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                  {hasTargetRole ? '✓' : '2'}
                </span>
                Select a target role so we know what to measure
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  3
                </span>
                Add evidence: assessments, projects, resume, GitHub
              </li>
            </ul>
            {!hasTargetRole ? (
              <Button onClick={() => (window.location.href = '/dashboard/roles')}>
                Choose target roles
              </Button>
            ) : (
              <Button onClick={() => (window.location.href = '/dashboard/profile')}>
                Continue setup
              </Button>
            )}
          </CardContent>
        </Card>

        {hasTargetRole && roleDetail && (
          <Card>
            <CardHeader>
              <CardDescription>{roleDetail.family}</CardDescription>
              <CardTitle className="text-lg">{roleDetail.name}</CardTitle>
              {roleDetail.description && (
                <CardDescription>{roleDetail.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Competencies to build</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {roleDetail.competencies.map((comp) => (
                    <div key={comp.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{comp.name}</p>
                      <ul className="mt-2 space-y-1.5">
                        {comp.skills.map((skill) => {
                          const req = reqBySkill.get(skill.id);
                          return (
                            <li key={skill.id} className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-600">{skill.name}</span>
                              {req && (
                                <span
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                                    LEVEL_STYLES[req.baselineLevel] ?? LEVEL_STYLES.optional,
                                  )}
                                >
                                  {req.baselineLevel}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <Link to="/dashboard/roles" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Change target roles
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Career readiness estimate</CardDescription>
              <CardTitle className="text-2xl">{hasTargetRole ? (readiness?.roles[0]?.overall ?? '…') : '—'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              {readiness?.roles[0] ? (
                <>
                  <p>{readiness.roles[0].roleName}</p>
                  <div className="flex flex-wrap gap-2">
                    {readiness.roles[0].dimensions.evidenceConfidence != null && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        evidence confidence {readiness.roles[0].dimensions.evidenceConfidence}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      evidence-weighted
                    </span>
                  </div>
                  <p className="text-xs">{readiness.explanation}</p>
                </>
              ) : (
                <p>{hasTargetRole ? 'Add evidence to unlock your estimate.' : 'Set a target role to see your estimate.'}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Evidence coverage</CardDescription>
              <CardTitle className="text-2xl">
                {readiness?.roles[0] ? readiness.roles[0].missingEvidence.length : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              {readiness?.roles[0]
                ? `missing evidence items for ${readiness.roles[0].roleName}. Evidence, not claims, drives the estimate.`
                : 'No evidence recorded yet.'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Next best action</CardDescription>
              <CardTitle className="text-base leading-snug">
                {readiness?.roles[0]?.nextBestAction?.action ?? '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              {readiness?.roles[0]?.nextBestAction?.reason ?? (
                <>{hasTargetRole ? 'Add evidence to start measuring readiness.' : 'Complete your profile to get started.'}</>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}