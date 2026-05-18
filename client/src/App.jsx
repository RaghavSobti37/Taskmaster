import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DashboardSkeleton } from './components/ui';

// Lazy loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ProjectsView = lazy(() => import('./pages/projects/ProjectsView'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const ProjectCreate = lazy(() => import('./pages/projects/ProjectCreate'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const CalendarView = lazy(() => import('./pages/calendar/CalendarView'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const DailyLogPage = lazy(() => import('./pages/productivity/DailyLogPage'));
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage'));
const AssetsPage = lazy(() => import('./pages/assets/AssetsPage'));
const LeadsPage = lazy(() => import('./pages/crm/LeadsPage'));
const FollowupsPage = lazy(() => import('./pages/crm/FollowupsPage'));
const FeaturesPage = lazy(() => import('./pages/marketing/FeaturesPage'));
const TodoPage = lazy(() => import('./pages/productivity/TodoPage'));
const GoogleSuccessPage = lazy(() => import('./pages/auth/GoogleSuccessPage'));
const ArtistsCollection = lazy(() => import('./pages/artists/ArtistsCollection'));
const ArtistDetail = lazy(() => import('./pages/artists/ArtistDetail'));
const UnsubscribePage = lazy(() => import('./pages/Unsubscribe'));
const CampaignDetails = lazy(() => import('./pages/CampaignDetails'));
const WorkflowCanvas = lazy(() => import('./pages/productivity/WorkflowCanvas'));
const OfficeAssetsPage = lazy(() => import('./pages/office/OfficeAssetsPage'));
const MetaOAuthCallback = lazy(() => import('./pages/auth/MetaOAuthCallback'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const UserDataDeletion = lazy(() => import('./pages/legal/UserDataDeletion'));

function App() {
  const { loading } = useAuth();

  if (loading) return <DashboardSkeleton />;

  return (
    <ThemeProvider>
      <Suspense fallback={<DashboardSkeleton />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/google/success" element={<GoogleSuccessPage />} />
          <Route path="/oauth/meta/callback" element={<MetaOAuthCallback />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/userdata" element={<UserDataDeletion />} />
          <Route path="/preview/artist/:id/*" element={<ArtistDetail isPreview={true} />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<ProjectsView />} />
              <Route path="projects/new" element={<ProjectCreate />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="calendar" element={<CalendarView />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="logs" element={<DailyLogPage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="office-assets" element={<OfficeAssetsPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="followups" element={<FollowupsPage />} />
              <Route path="features" element={<FeaturesPage />} />
              <Route path="todo" element={<TodoPage />} />
              <Route path="workflows" element={<WorkflowCanvas />} />
              <Route element={<AdminRoute />}>
                <Route path="admin" element={<AdminPanel />} />
                <Route path="admin/logs" element={<AdminLogsPage />} />
                <Route path="artists" element={<ArtistsCollection />} />
                <Route path="artists/:id/*" element={<ArtistDetail />} />
                <Route path="campaign/:campaignId" element={<CampaignDetails />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
