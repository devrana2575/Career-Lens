import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const IMPACT_STYLES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(null);

  const refresh = useCallback(async () => {
    const { roadmaps: list } = await apiFetch('/roadmap');
    setRoadmaps(list);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [refresh]);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const { roadmaps: list } = await apiFetch('/roadmap/generate', { method: 'POST' });
      setRoadmaps(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleTask(roadmapId, taskId) {
    setToggling(taskId);
    setError('');
    try {
      const updated = await apiFetch(`/roadmap/${roadmapId}/tasks/${taskId}`, { method: 'PATCH' });
      setRoadmaps((prev) => prev.map((r) => (r.id === roadmapId ? updated : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Loading roadmap…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Roadmap</h1>
            <p className="mt-1 text-sm text-slate-500">
              Personalized, evidence-driven next steps for your target roles. Checked items
              persist when you regenerate.
            </p>
          </div>
          <Button onClick={generate} disabled={generating}>
            {generating ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {roadmaps.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 py-8 text-center">
              <p className="text-sm text-slate-500">
                No roadmap has been generated yet. Add a target role in your profile, then
                generate your first personalized roadmap.
              </p>
              <Button onClick={generate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate roadmap'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          roadmaps.map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} toggling={toggling} toggleTask={toggleTask} />
          ))
        )}
      </div>
    </Layout>
  );
}

function RoadmapCard({ roadmap, toggling, toggleTask }) {
  const openTasks = roadmap.tasks.filter((t) => t.status !== 'done');
  const doneTasks = roadmap.tasks.filter((t) => t.status === 'done');
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{roadmap.roleName}</CardTitle>
          <span className="text-sm font-medium text-slate-600">{roadmap.progress}% done</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div
            className={cn('h-full rounded-full transition-all', roadmap.progress >= 100 ? 'bg-green-500' : 'bg-indigo-500')}
            style={{ width: `${roadmap.progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Last generated {new Date(roadmap.generatedAt).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {openTasks.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Next steps</h4>
            <ul className="space-y-2">
              {openTasks.map((task) => (
                <TaskItem key={task.id} task={task} roadmapId={roadmap.id} toggling={toggling} toggleTask={toggleTask} />
              ))}
            </ul>
          </div>
        )}

        {doneTasks.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Completed</h4>
            <ul className="space-y-1">
              {doneTasks.map((task) => (
                <TaskItem key={task.id} task={task} roadmapId={roadmap.id} toggling={toggling} toggleTask={toggleTask} done />
              ))}
            </ul>
          </div>
        )}

        {roadmap.tasks.length === 0 && (
          <p className="py-4 text-center text-sm text-green-700">
            All evidence thresholds are met — no open gaps right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TaskItem({ task, roadmapId, toggling, toggleTask, done }) {
  const isToggling = toggling === task.id;
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2',
        done ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white',
      )}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={isToggling}
        onChange={() => toggleTask(roadmapId, task.id)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done ? 'text-slate-500 line-through' : 'text-slate-800')}>
          {task.action}
        </p>
        {task.reason && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{task.reason}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.effortEstimate && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            {task.effortEstimate}
          </span>
        )}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            IMPACT_STYLES[task.impact] ?? IMPACT_STYLES.low,
          )}
        >
          {task.impact}
        </span>
      </div>
    </li>
  );
}