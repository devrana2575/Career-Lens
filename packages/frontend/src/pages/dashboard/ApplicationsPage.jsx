import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const STATUS_STYLES = {
  applied: 'bg-slate-100 text-slate-700',
  interviewing: 'bg-amber-100 text-amber-700',
  offered: 'bg-green-100 text-green-700',
  rejected: 'bg-rose-100 text-rose-700',
  withdrawn: 'bg-slate-100 text-slate-400',
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/applications')
      .then(setApplications)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id, status) {
    try {
      const updated = await apiFetch(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function withdraw(id) {
    try {
      await apiFetch(`/applications/${id}`, { method: 'DELETE' });
      setApplications((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My applications</h1>
            <p className="mt-1 text-sm text-slate-500">Track every role you have applied to.</p>
          </div>
          <Link to="/dashboard/jobs" className="text-sm text-indigo-600 hover:underline">
            Browse jobs →
          </Link>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {applications.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">No applications yet. Start with the job board.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{a.job?.title ?? a.jobId}</CardTitle>
                      <CardDescription>
                        {[a.job?.company, a.job?.location].filter(Boolean).join(' · ') || ' '}
                      </CardDescription>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[a.status] ?? STATUS_STYLES.applied)}>
                      {a.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-3 text-sm">
                  <select
                    value={a.status}
                    onChange={(e) => updateStatus(a.id, e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                  >
                    {['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => withdraw(a.id)}
                    className="text-sm text-rose-600 hover:underline"
                  >
                    Withdraw
                  </button>
                  {a.notes && <span className="text-xs text-slate-500">{a.notes}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}