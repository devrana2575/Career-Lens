import { useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/jobs'), apiFetch('/applications')])
      .then(([j, a]) => {
        setJobs(j);
        setApplications(a);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const appliedJobIds = new Set(applications.map((a) => a.jobId));

  async function apply(jobId) {
    setError('');
    try {
      await apiFetch('/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
      setApplications((prev) => [...prev, { id: 'pending', jobId, status: 'applied' }]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse open roles and track your applications. Matching skills come from your own evidence.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Loading jobs…</p>}

        {jobs.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">No jobs posted yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const applied = appliedJobIds.has(job.id);
              return (
                <Card key={job.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{job.title}</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[job.company, job.location].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => apply(job.id)}
                        disabled={applied}
                      >
                        {applied ? 'Applied' : 'Apply'}
                      </Button>
                    </div>
                  </CardHeader>
                  {job.description && (
                    <CardContent>
                      <p className="text-sm text-slate-600 line-clamp-3">{job.description}</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}