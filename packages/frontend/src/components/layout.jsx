import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.jsx';
import { cn } from '../lib/utils.js';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/profile', label: 'Profile', end: false },
  { to: '/dashboard/roles', label: 'Target roles', end: false },
  { to: '/dashboard/evidence', label: 'Evidence', end: false },
  { to: '/dashboard/assessments', label: 'Assessments', end: false },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}