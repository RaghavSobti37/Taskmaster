import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectsView from './pages/ProjectsView';
import ProjectDetail from './pages/ProjectDetail';
import ProjectCreate from './pages/ProjectCreate';
import AdminPanel from './pages/AdminPanel';
// import TeamView from './pages/TeamView';
import CalendarView from './pages/CalendarView';
import SettingsPage from './pages/SettingsPage';
import DailyLogPage from './pages/DailyLogPage';
import AdminLogsPage from './pages/AdminLogsPage';
import AssetsPage from './pages/AssetsPage';
import LeadsPage from './pages/LeadsPage';
import FollowupsPage from './pages/FollowupsPage';
import NotificationsPage from './pages/NotificationsPage';

import FeaturesPage from './pages/FeaturesPage';
import TodoPage from './pages/TodoPage';
import GoogleSuccessPage from './pages/GoogleSuccessPage';
import ProtectedRoute from './components/ProtectedRoute';


import AdminRoute from './components/AdminRoute';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

import NexusLoader from './components/ui/NexusLoader';

function App() {
  const { user, loading } = useAuth();

  if (loading) return <NexusLoader />;


  return (
    <ThemeProvider>
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
            <Route path="notifications" element={<NotificationsPage />} />


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
    </ThemeProvider>
  );
}

export default App;
