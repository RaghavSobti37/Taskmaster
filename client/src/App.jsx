import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import NexusLoader from './components/ui/NexusLoader';

// Lazy loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProjectsView = lazy(() => import('./pages/ProjectsView'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ProjectCreate = lazy(() => import('./pages/ProjectCreate'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DailyLogPage = lazy(() => import('./pages/DailyLogPage'));
const AdminLogsPage = lazy(() => import('./pages/AdminLogsPage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const FollowupsPage = lazy(() => import('./pages/FollowupsPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const TodoPage = lazy(() => import('./pages/TodoPage'));
const GoogleSuccessPage = lazy(() => import('./pages/GoogleSuccessPage'));

function App() {
  const { user, loading } = useAuth();

  if (loading) return <NexusLoader />;


  return (
    <ThemeProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/google/success" element={<GoogleSuccessPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<ProjectsView />} />
              <Route path="projects/new" element={<ProjectCreate />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              {/* <Route path="team" element={<TeamView />} /> */}
              <Route path="calendar" element={<CalendarView />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="logs" element={<DailyLogPage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="followups" element={<FollowupsPage />} />



              <Route path="features" element={<FeaturesPage />} />
              <Route path="todo" element={<TodoPage />} />
              <Route element={<AdminRoute />}>


                <Route path="admin" element={<AdminPanel />} />
                <Route path="admin/logs" element={<AdminLogsPage />} />
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
