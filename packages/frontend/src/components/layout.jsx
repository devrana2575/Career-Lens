import { NavLink, useNavigate } from 'react-router-dom';
import NotificationBell from './notification-bell.jsx';
import { useAuth } from '../lib/auth-context.jsx';
import { cn } from '../lib/utils.js';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/roadmap', label: 'Roadmap', end: false },
  { to: '/dashboard/jobs', label: 'Jobs', end: false },
  { to: '/dashboard/applications', label: 'Applications', end: false },
  { to: '/dashboard/compare', label: 'Compare roles', end: false },
  { to: '/dashboard/profile', label: 'Profile', end: false },
  { to: '/dashboard/roles', label: 'Target roles', end: false },
  { to: '/dashboard/evidence', label: 'Evidence', end: false },
  { to: '/dashboard/assessments', label: 'Assessments', end: false },
  { to: '/dashboard/market', label: 'Market', end: false },
  { to: '/dashboard/resume', label: 'Resume', end: false },
  { to: '/dashboard/github', label: 'GitHub', end: false },
  { to: '/dashboard/projects', label: 'Projects', end: false },
  { to: '/dashboard/coach', label: 'Coach', end: false },
];

const reviewerNavItems = [
  { to: '/dashboard/reviews', label: 'Reviews', end: false },
  { to: '/dashboard/assessment-bank', label: 'Assessment bank', end: false },
];

const recruiterNavItems = [
  { to: '/dashboard/candidates', label: 'Candidates', end: false },
  { to: '/dashboard/recruiter/applications', label: 'My applicants', end: false },
  { to: '/dashboard/shortlists', label: 'Shortlists', end: false },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isReviewer = user?.role === 'admin' || user?.role === 'mentor';
  const isRecruiter = user?.role === 'admin' || user?.role === 'recruiter';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <span className="text-sm font-semibold text-slate-900">
            Career Intelligence
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          {isReviewer &&
            reviewerNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          {isRecruiter &&
            recruiterNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user?.displayName}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-y-auto bg-slate-50">
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-slate-200 bg-white px-6">
          <NotificationBell />
        </div>
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}