import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import ProfilePage from './pages/dashboard/ProfilePage.jsx';
import RolesPage from './pages/dashboard/RolesPage.jsx';
import EvidencePage from './pages/dashboard/EvidencePage.jsx';
import AssessmentsPage from './pages/dashboard/AssessmentsPage.jsx';
import ReviewsPage from './pages/dashboard/ReviewsPage.jsx';
import MarketPage from './pages/dashboard/MarketPage.jsx';
import ResumePage from './pages/dashboard/ResumePage.jsx';
import GitHubPage from './pages/dashboard/GitHubPage.jsx';
import ProjectsPage from './pages/dashboard/ProjectsPage.jsx';
import CandidatesPage from './pages/dashboard/CandidatesPage.jsx';
import CandidateDetailPage from './pages/dashboard/CandidateDetailPage.jsx';
import ShortlistsPage from './pages/dashboard/ShortlistsPage.jsx';
import CoachPage from './pages/dashboard/CoachPage.jsx';
import NotificationsPage from './pages/dashboard/NotificationsPage.jsx';
import AssessmentBankPage from './pages/dashboard/AssessmentBankPage.jsx';
import RoadmapPage from './pages/dashboard/RoadmapPage.jsx';
import ComparePage from './pages/dashboard/ComparePage.jsx';
import CandidateComparePage from './pages/dashboard/CandidateComparePage.jsx';

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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
          <Route
            path="/dashboard/resume"
            element={
              <RequireAuth>
                <ResumePage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/github"
            element={
              <RequireAuth>
                <GitHubPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/candidates"
            element={
              <RequireAuth>
                <CandidatesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/candidates/:id"
            element={
              <RequireAuth>
                <CandidateDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/shortlists"
            element={
              <RequireAuth>
                <ShortlistsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/coach"
            element={
              <RequireAuth>
                <CoachPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/assessment-bank"
            element={
              <RequireAuth>
                <AssessmentBankPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/roadmap"
            element={
              <RequireAuth>
                <RoadmapPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/compare"
            element={
              <RequireAuth>
                <ComparePage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/candidates/compare"
            element={
              <RequireAuth>
                <CandidateComparePage />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}