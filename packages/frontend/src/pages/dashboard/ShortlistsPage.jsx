import { useState, useEffect } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';

export default function ShortlistsPage() {
  const [shortlists, setShortlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadShortlists();
  }, []);

  async function loadShortlists() {
    setLoading(true);
    try {
      const data = await apiFetch('/recruiter/shortlists');
      setShortlists(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/recruiter/shortlists', {
        method: 'POST',
        body: { name: newName, candidateIds: [] },
      });
      setNewName('');
      setShowForm(false);
      await loadShortlists();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this shortlist?')) return;
    try {
      await apiFetch(`/recruiter/shortlists/${id}`, { method: 'DELETE' });
      await loadShortlists();
    } catch {
      // ignore
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Shortlists</h1>
            <p className="mt-1 text-sm text-slate-500">
              Create named shortlists to track and compare candidates.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New shortlist'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create shortlist</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex gap-3">
                <Input
                  required
                  placeholder="e.g. Summer 2026 Batch A"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Create'}
                </Button>
              </form>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your shortlists</CardTitle>
            <CardDescription>
              {shortlists.length} shortlist{shortlists.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading shortlists…</p>
            ) : shortlists.length === 0 ? (
              <p className="text-sm text-slate-500">
                No shortlists yet. Create one to start tracking candidates.
              </p>
            ) : (
              <ul className="space-y-2">
                {shortlists.map((sl) => (
                  <li
                    key={sl._id || sl.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <h3 className="text-sm font-medium text-slate-900">{sl.name}</h3>
                      <p className="text-xs text-slate-400">
                        {sl.candidateIds?.length ?? 0} candidate{(sl.candidateIds?.length ?? 0) === 1 ? '' : 's'} ·
                        created {new Date(sl.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(sl._id || sl.id)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
