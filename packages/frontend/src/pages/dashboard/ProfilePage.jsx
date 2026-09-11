import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/profiles/me').then((p) =>
      setForm({
        headline: p.headline ?? '',
        location: p.location ?? '',
        githubUsername: p.githubUsername ?? '',
        yearsOfExperience: p.yearsOfExperience ?? 0,
        bio: p.bio ?? '',
      }),
    );
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/profiles/me', { method: 'PATCH', body: form });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!form) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading profile…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            This is your self-reported profile. Validated evidence is tracked separately and
            carries more weight in readiness estimates.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Professional details</CardTitle>
            <CardDescription>
              Saves and returns you to the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="headline">Professional headline</label>
                <input
                  id="headline"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="e.g. Aspiring Data Scientist"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="location">Location</label>
                <input
                  id="location"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Bengaluru, India"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="github">GitHub username</label>
                <input
                  id="github"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.githubUsername}
                  onChange={(e) => setForm({ ...form, githubUsername: e.target.value })}
                  placeholder="e.g. devrana2575"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="yoe">Years of relevant experience</label>
                <input
                  id="yoe"
                  type="number"
                  min="0"
                  max="50"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.yearsOfExperience}
                  onChange={(e) => setForm({ ...form, yearsOfExperience: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="bio">About you</label>
                <textarea
                  id="bio"
                  rows={4}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="A short professional summary."
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}