import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ArtistRoute from './components/ArtistRoute';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useToast } from './contexts/ToastContext';
import { DashboardSkeleton } from './components/ui';
import axios from 'axios';

// Helper to retry dynamic imports when a redeploy changes chunk hashes
const lazyWithRetry = (componentImport) => 
  lazy(async () => {
    const hasRetried = window.sessionStorage.getItem('chunk-retry');
    try {
      const component = await componentImport();
      window.sessionStorage.removeItem('chunk-retry');
      return component;
    } catch (error) {
      if (!hasRetried) {
        window.sessionStorage.setItem('chunk-retry', 'true');
        window.location.reload();
        return new Promise(() => {}); // Keep loading state until reload
      }
      throw error;
    }
  });

// Lazy loaded pages
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('./pages/auth/RegisterPage'));
const ProjectsView = lazyWithRetry(() => import('./pages/projects/ProjectsView'));
const ProjectDetail = lazyWithRetry(() => import('./pages/projects/ProjectDetail'));
const ProjectCreate = lazyWithRetry(() => import('./pages/projects/ProjectCreate'));
const AdminPanel = lazyWithRetry(() => import('./pages/admin/AdminPanel'));
const CalendarView = lazyWithRetry(() => import('./pages/calendar/CalendarView'));
const SettingsPage = lazyWithRetry(() => import('./pages/settings/SettingsPage'));
const DailyLogPage = lazyWithRetry(() => import('./pages/productivity/DailyLogPage'));
const AdminLogsPage = lazyWithRetry(() => import('./pages/admin/AdminLogsPage'));
const AssetsPage = lazyWithRetry(() => import('./pages/assets/AssetsPage'));
const LeadsPage = lazyWithRetry(() => import('./pages/crm/LeadsPage'));
const FollowupsPage = lazyWithRetry(() => import('./pages/crm/FollowupsPage'));
const FeaturesPage = lazyWithRetry(() => import('./pages/marketing/FeaturesPage'));
const GoogleSuccessPage = lazyWithRetry(() => import('./pages/auth/GoogleSuccessPage'));
const ArtistsCollection = lazyWithRetry(() => import('./pages/artists/ArtistsCollection'));
const ArtistDetail = lazyWithRetry(() => import('./pages/artists/ArtistDetail'));
const UnsubscribePage = lazyWithRetry(() => import('./pages/Unsubscribe'));
const CampaignDetails = lazyWithRetry(() => import('./pages/CampaignDetails'));
const WorkflowCanvas = lazyWithRetry(() => import('./pages/productivity/WorkflowCanvas'));
const OfficeAssetsPage = lazyWithRetry(() => import('./pages/office/OfficeAssetsPage'));
const MetaOAuthCallback = lazyWithRetry(() => import('./pages/auth/MetaOAuthCallback'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/legal/PrivacyPolicy'));
const UserDataDeletion = lazyWithRetry(() => import('./pages/legal/UserDataDeletion'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));

function App() {
  const { loading } = useAuth();
  const { addToast } = useToast();

  React.useEffect(() => {
    const resInterceptor = axios.interceptors.response.use(
      (response) => {
        const method = response.config.method?.toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method)) {
          const message = response.data?.message || 'Operation successful';
          addToast({ title: 'Success', message, type: 'success' });
        }
        return response;
      },
      (error) => {
        const method = error.config?.method?.toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method)) {
          const message = error.response?.data?.message || error.response?.data?.error || error.message || 'An error occurred';
          addToast({ title: 'Error', message, type: 'error' });
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(resInterceptor);
  }, [addToast]);

  if (loading) return <DashboardSkeleton />;

  return (
    <ThemeProvider>
      <Suspense fallback={<DashboardSkeleton />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/google/success" element={<GoogleSuccessPage />} />
          <Route path="/oauth/meta/callback" element={<MetaOAuthCallback />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/userdata" element={<UserDataDeletion />} />
          <Route path="/preview/artist/:id/*" element={<ArtistDetail isPreview={true} />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsView />} />
              <Route path="/projects/new" element={<ProjectCreate />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/logs" element={<DailyLogPage />} />
              <Route path="/assets" element={<AssetsPage />} />
              <Route path="/office-assets" element={<OfficeAssetsPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/followups" element={<FollowupsPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/workflows" element={<WorkflowCanvas />} />
              
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/logs" element={<AdminLogsPage />} />
                <Route path="/campaign/:campaignId" element={<CampaignDetails />} />
              </Route>
              
              <Route element={<ArtistRoute />}>
                <Route path="/artists" element={<ArtistsCollection />} />
                <Route path="/artists/:id/*" element={<ArtistDetail />} />
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
