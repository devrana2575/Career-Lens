import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import ProfilePage from './pages/dashboard/ProfilePage.jsx';
import RolesPage from './pages/dashboard/RolesPage.jsx';
import EvidencePage from './pages/dashboard/EvidencePage.jsx';
import AssessmentsPage from './pages/dashboard/AssessmentsPage.jsx';
import ReviewsPage from './pages/dashboard/ReviewsPage.jsx';
import MarketPage from './pages/dashboard/MarketPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/roles"
            element={
              <RequireAuth>
                <RolesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/evidence"
            element={
              <RequireAuth>
                <EvidencePage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/assessments"
            element={
              <RequireAuth>
                <AssessmentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/reviews"
            element={
              <RequireAuth>
                <ReviewsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/market"
            element={
              <RequireAuth>
                <MarketPage />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}