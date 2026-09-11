import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth-context.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';

const STATUS_OPTIONS = ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];

export default function RecruiterApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'recruiter' && user?.role !== 'admin') return;
    setLoading(true);
    apiFetch('/recruiter/applications')
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  async function handleStatusChange(id, newStatus) {
    await apiFetch(`/recruiter/applications/${id}`, {
      method: 'PATCH',
      body: { status: newStatus },
    });
    setApplications((prev) =>
      prev.map((a) => (a._id === id ? { ...a, status: newStatus } : a)),
    );
  }

  if (loading) return <p className="p-8 text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">Applicants</h1>

      {applications.length === 0 ? (
        <p className="text-slate-500">No applications yet.</p>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app._id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {app.candidate?.displayName ?? 'Unknown candidate'}
                  </CardTitle>
                  <span className="text-xs text-slate-500">
                    Applied {new Date(app.appliedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {app.job?.title ?? 'Unknown job'} · {app.job?.company ?? ''}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app._id, e.target.value)}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                {app.candidate?.email && (
                  <p className="mt-2 text-xs text-slate-500">{app.candidate.email}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}