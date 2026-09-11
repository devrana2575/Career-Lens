import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { cn } from '../lib/utils.js';

function formatTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  async function refresh() {
    try {
      const data = await apiFetch('/notifications?limit=6');
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  async function handleReadAll() {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST', body: {} });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={handleReadAll}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'border-b border-slate-50 px-4 py-3',
                    !n.isRead && 'bg-indigo-50/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    {!n.isRead && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatTime(n.createdAt)}</p>
                </div>
              ))
            )}
            {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-right">
            <Link to="/dashboard/notifications" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}