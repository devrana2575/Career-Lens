import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const KIND_LABELS = {
  assessment_completed: 'Assessment completed',
  assessment_reviewed: 'Assessment reviewed',
  shortlisted: 'Shortlist',
};

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch('/notifications');
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleMarkRead(id) {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST', body: {} });
    await refresh();
  }

  async function handleMarkAllRead() {
    await apiFetch('/notifications/read-all', { method: 'POST', body: {} });
    await refresh();
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">
              Updates on assessments, reviews, and recruiter activity.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-slate-500">
              You have no notifications yet. Completing assessments or being shortlisted will show up here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <Card key={n.id} className={cn(!n.isRead && 'border-indigo-300 bg-indigo-50/40')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {!n.isRead && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                      <CardTitle className="text-base">{n.title}</CardTitle>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                      {KIND_LABELS[n.kind] ?? n.kind}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id).catch(() => {})}
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}