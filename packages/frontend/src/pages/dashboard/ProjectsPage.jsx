import { useState, useEffect } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';

const EMPTY_FORM = {
  title: '',
  description: '',
  url: '',
  repoUrl: '',
  techStack: '',
  skillsUsed: '',
  startDate: '',
  endDate: '',
  isOngoing: false,
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await apiFetch('/projects');
      setProjects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(project) {
    setForm({
      title: project.title,
      description: project.description,
      url: project.url ?? '',
      repoUrl: project.repoUrl ?? '',
      techStack: (project.techStack || []).join(', '),
      skillsUsed: '',
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
      isOngoing: project.isOngoing ?? false,
    });
    setEditingId(project.id);
    setShowForm(true);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const techStack = form.techStack
        ? form.techStack.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const skillsUsed = form.skillsUsed
        ? form.skillsUsed.split(',').map((s) => s.trim()).filter(Boolean).map((slug) => ({
            skillSlug: slug,
            skillId: slug,
          }))
        : [];

      const body = {
        title: form.title,
        description: form.description,
        url: form.url || null,
        repoUrl: form.repoUrl || null,
        techStack,
        skillsUsed,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isOngoing: form.isOngoing,
      };

      if (editingId) {
        await apiFetch(`/projects/${editingId}`, { method: 'PUT', body });
      } else {
        await apiFetch('/projects', { method: 'POST', body });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this project? This will remove its evidence.')) return;
    try {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
      await loadProjects();
    } catch {
      // ignore
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
            <p className="mt-1 text-sm text-slate-500">
              Track projects you have built. Each project becomes supporting evidence in your skill profile.
            </p>
          </div>
          <Button onClick={openNew}>{showForm ? 'Cancel' : '+ Add project'}</Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Edit project' : 'New project'}</CardTitle>
              <CardDescription>
                Projects with descriptions, URLs, and tagged skills produce stronger evidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Title *</label>
                  <Input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. E-commerce Platform"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Description *</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What does this project do? What was your role?"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Live URL</label>
                    <Input
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Repo URL</label>
                    <Input
                      type="url"
                      value={form.repoUrl}
                      onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                      placeholder="https://github.com/..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Tech stack (comma-separated)</label>
                  <Input
                    value={form.techStack}
                    onChange={(e) => setForm({ ...form, techStack: e.target.value })}
                    placeholder="e.g. React, Node.js, PostgreSQL"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Skills used (comma-separated slugs)</label>
                  <Input
                    value={form.skillsUsed}
                    onChange={(e) => setForm({ ...form, skillsUsed: e.target.value })}
                    placeholder="e.g. react, nodejs, postgresql"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Start date</label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">End date</label>
                    <Input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      disabled={form.isOngoing}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isOngoing}
                    onChange={(e) => setForm({ ...form, isOngoing: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Currently ongoing
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Update project' : 'Create project'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your projects</CardTitle>
            <CardDescription>
              {projects.length} project{projects.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading projects…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-slate-500">
                No projects yet. Click &quot;Add project&quot; to get started.
              </p>
            ) : (
              <ul className="space-y-3">
                {projects.map((project) => (
                  <li key={project.id} className="rounded-md border border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-slate-900">{project.title}</h3>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{project.description}</p>
                        {project.techStack && project.techStack.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {project.techStack.map((t) => (
                              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex gap-3 text-xs text-slate-400">
                          {project.url && (
                            <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                              Live demo
                            </a>
                          )}
                          {project.repoUrl && (
                            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                              Source code
                            </a>
                          )}
                          {project.startDate && (
                            <span>
                              {new Date(project.startDate).toLocaleDateString()}
                              {project.endDate ? ` – ${new Date(project.endDate).toLocaleDateString()}` : project.isOngoing ? ' – Present' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(project)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                          Delete
                        </Button>
                      </div>
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
