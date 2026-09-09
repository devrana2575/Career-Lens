import { useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const SOURCE_TYPES = [
  ['technical_assessment', 'Technical assessment'],
  ['coding_assessment', 'Coding assessment'],
  ['sql_assessment', 'SQL assessment'],
  ['practical_task', 'Practical task'],
  ['dsa_practice', 'DSA practice'],
  ['github', 'GitHub evidence'],
  ['project', 'Project'],
  ['deployed_application', 'Deployed application'],
  ['resume', 'Resume'],
  ['certification', 'Certification'],
  ['internship', 'Internship'],
  ['experience', 'Work experience'],
  ['portfolio', 'Portfolio'],
  ['self_reported', 'Self-reported'],
];

const STRENGTH_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

const CONFIDENCE_TEXT = {
  ['low']: 'Low confidence — treat as indicative only',
  medium: 'Medium confidence',
  high: 'High confidence',
};

function confidenceBand(score) {
  if (score == null) return null;
  if (score >= 75) return { key: 'high', text: 'High' };
  if (score >= 45) return { key: 'medium', text: 'Medium' };
  return { key: 'low', text: 'Low' };
}

const EMPTY_FORM = {
  skillId: '',
  sourceType: 'coding_assessment',
  strength: 'medium',
  score: '',
  description: '',
  occurredAt: '',
};

export default function EvidencePage() {
  const [graph, setGraph] = useState(null);
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  async function refresh() {
    const [g, s] = await Promise.all([apiFetch('/evidence/graph'), apiFetch('/skills')]);
    setGraph(g);
    setSkills(s.skills);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  const matchingSkills = skills.filter((skill) =>
    skill.name.toLowerCase().includes(filter.toLowerCase()),
  );

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const source = {
        type: form.sourceType,
        strength: form.strength,
        ...(form.score !== '' && form.score != null ? { score: Number(form.score) } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.occurredAt ? { occurredAt: new Date(form.occurredAt).toISOString() } : {}),
      };
      await apiFetch('/evidence', { method: 'POST', body: { skillId: form.skillId, source } });
      setForm(EMPTY_FORM);
      setFilter('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const assessments = graph?.skillAssessments ?? [];

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Evidence</h1>
          <p className="mt-1 text-sm text-slate-500">
            Readiness estimates are built only from evidence — assessments, projects, resume,
            GitHub, practice records. Every score shows the sources behind it.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add evidence</CardTitle>
            <CardDescription>
              Each piece links one skill to a source. Strong sources (e.g. graded assessments,
              deployed projects) matter more than self-reported claims.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="skill-filter">
                    Skill
                  </label>
                  <input
                    id="skill-filter"
                    list="skill-options"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search for a skill…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    onBlur={() => {
                      if (!form.skillId || !filter) return;
                      const picked = matchingSkills.find((s) => s.name === filter);
                      if (picked && picked.id !== form.skillId) setForm({ ...form, skillId: picked.id });
                    }}
                  />
                  <datalist id="skill-options">
                    {matchingSkills.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                  {form.skillId && (
                    <p className="text-xs text-slate-500">Selected skill id: {form.skillId}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="source-type">
                    Source type
                  </label>
                  <select
                    id="source-type"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.sourceType}
                    onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                  >
                    {SOURCE_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="strength">
                    Strength
                  </label>
                  <select
                    id="strength"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.strength}
                    onChange={(e) => setForm({ ...form, strength: e.target.value })}
                  >
                    {Object.entries(STRENGTH_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="score">
                    Score (0–100, optional)
                  </label>
                  <input
                    id="score"
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.score}
                    onChange={(e) => setForm({ ...form, score: e.target.value })}
                    placeholder="e.g. 82"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="occurredAt">
                    When (optional)
                  </label>
                  <input
                    id="occurredAt"
                    type="date"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.occurredAt}
                    onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="description">
                    Description / link (optional)
                  </label>
                  <input
                    id="description"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Financial data cleaning and EDA project (GitHub repo link)"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={saving || !form.skillId}>
                {saving ? 'Saving…' : 'Add evidence'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Skill assessments
          </h2>
          {assessments.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-slate-500">
                No evidence recorded yet. Add your first piece above.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {assessments.map((a) => {
                const band = confidenceBand(a.confidenceScore);
                const hasScore = a.proficiencyScore != null;
                return (
                  <Card key={a.skillId}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">{a.skillName}</CardTitle>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <CardDescription>Proficiency</CardDescription>
                            <p className="text-lg font-semibold text-slate-900">
                              {hasScore ? `${a.proficiencyScore}` : '—'}
                            </p>
                          </div>
                          <div>
                            <CardDescription>Confidence</CardDescription>
                            <p className="text-lg font-semibold text-slate-900">
                              {a.confidenceScore}
                            </p>
                          </div>
                          {band && (
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-xs font-medium',
                                band.key === 'high' && 'bg-green-100 text-green-700',
                                band.key === 'medium' && 'bg-amber-100 text-amber-700',
                                band.key === 'low' && 'bg-slate-100 text-slate-600',
                              )}
                            >
                              {CONFIDENCE_TEXT[band.key]}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {a.sources.map((src, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-600">
                            <span className="font-medium capitalize">{src.type.replace(/_/g, ' ')}</span>
                            {src.description ? ` — ${src.description}` : ''}{' '}
                            {src.score != null && <span className="text-slate-900 font-medium">{src.score}</span>}
                          </span>
                          <span className="shrink-0 text-xs capitalize text-slate-400">
                            strength: {src.strength}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}