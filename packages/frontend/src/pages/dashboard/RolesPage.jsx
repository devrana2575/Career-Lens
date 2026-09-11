import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { cn } from '../../lib/utils.js';

export default function RolesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/roles')
      .then((res) => {
        setData(res);
        return apiFetch('/profiles/me');
      })
      .then((profile) => setSelected(profile.targetRoleIds ?? []))
      .catch((err) => setError(err.message));
  }, []);

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/profiles/me', { method: 'PATCH', body: { targetRoleIds: selected } });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading roles…</p>
      </Layout>
    );
  }

  const roleIds = new Set(data.roles.map((r) => String(r._id)));

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Choose your target role</h1>
            <p className="mt-1 text-sm text-slate-500">
              We tailor readiness estimates and assessments to the roles you care about.
              You can update this any time.
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm">
            Skip for now
          </Button>
        </div>

        {data.families.map((family) => {
          const rows = data.roles.filter((r) => r.family === family);
          if (rows.length === 0) return null;
          return (
            <div key={family} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{family}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((role) => {
                  const id = String(role._id);
                  const isSelected = selected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={cn(
                        'rounded-xl border bg-white p-4 text-left shadow-sm transition-all',
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">{role.name}</span>
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs',
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 text-transparent',
                          )}
                        >
                          ✓
                        </span>
                      </div>
                      {role.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{role.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {selected.length > 0 && selected.some((id) => !roleIds.has(id)) && (
          <p className="text-sm text-amber-600">
            Some previously selected roles are no longer available and will be removed on save.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save selection'}
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    </Layout>
  );
}