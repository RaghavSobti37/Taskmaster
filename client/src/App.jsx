import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PageRoute from './components/PageRoute';
import AppBootFallback from './components/AppBootFallback';
import {
  slugId,
  parseErrorPayload,
  shouldShowApiSuccessToast,
  shouldShowApiErrorToast,
} from './lib/notifications';
import { emitSystemEvent, getClientTraceId, startClientTrace } from './lib/systemLogBridge';
import { inferModuleFromRoute, SEVERITY } from './lib/systemLogContract';
import axios from 'axios';
import { normalizeProject, normalizeProjects, normalizePopulatedProjectList } from './utils/projectUtils';
import { normalizeTasks, normalizeSchedulePayload } from './utils/normalizeTask';

const normalizeProjectsInResponse = (url, data) => {
  if (data == null) return data;
  const path = (url || '').split('?')[0];
  if (path === '/api/projects' || path.endsWith('/api/projects')) {
    return normalizeProjects(data);
  }
  if (/^\/api\/projects\/[^/]+$/.test(path) && data && !Array.isArray(data)) {
    return normalizeProject(data);
  }
  if (path.startsWith('/api/finance') && data?.data) {
    return { ...data, data: normalizePopulatedProjectList(data.data) };
  }
  if (path === '/api/schedule' || path.endsWith('/api/schedule')) {
    return normalizeSchedulePayload(data);
  }
  if (path === '/api/tasks' || path.endsWith('/api/tasks')) {
    return normalizeTasks(data);
  }
  return data;
};

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
const QATestingPage = lazyWithRetry(() => import('./pages/admin/QATestingPage'));
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/auth/ResetPasswordPage'));
const ProjectsView = lazyWithRetry(() => import('./pages/projects/ProjectsView'));
const ProjectDetail = lazyWithRetry(() => import('./pages/projects/ProjectDetail'));
const ProjectAnalyticsPage = lazyWithRetry(() => import('./pages/projects/ProjectAnalyticsPage'));
const ProjectCreate = lazyWithRetry(() => import('./pages/projects/ProjectCreate'));
const WorkspaceSettings = lazyWithRetry(() => import('./pages/projects/WorkspaceSettings'));
const AdminPanel = lazyWithRetry(() => import('./pages/admin/AdminPanel'));
const SystemLogsPage = lazyWithRetry(() => import('./pages/admin/SystemLogsPage'));
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'));
const AdminExly = lazyWithRetry(() => import('./pages/admin/AdminExly'));
const AdminMail = lazyWithRetry(() => import('./pages/admin/AdminMail'));
const AdminCRM = lazyWithRetry(() => import('./pages/admin/AdminCRM'));
const CalendarView = lazyWithRetry(() => import('./pages/calendar/CalendarView'));
const SettingsPage = lazyWithRetry(() => import('./pages/settings/SettingsPage'));

const DailyLogPage = lazyWithRetry(() => import('./pages/productivity/DailyLogPage'));
const AdminScriptsPage = lazyWithRetry(() => import('./pages/admin/AdminScriptsPage'));
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
import LandingPage from './pages/LandingPage';
const FinancePage = lazyWithRetry(() => import('./pages/finance/FinancePage'));
const ExlyCampaignsPage = lazyWithRetry(() => import('./pages/admin/ExlyCampaignsPage'));
const ExlyBookingsPage = lazyWithRetry(() => import('./pages/crm/ExlyBookingsPage'));
const EmailsPage = lazyWithRetry(() => import('./pages/workspace/EmailsPage'));
const CreateCampaignPage = lazyWithRetry(() => import('./pages/workspace/CreateCampaignPage'));
const OTPVerificationPage = lazyWithRetry(() => import('./pages/auth/OTPVerificationPage'));
const AttendancePage = lazyWithRetry(() => import('./pages/management/AttendancePage'));
const AnnouncementsPage = lazyWithRetry(() => import('./pages/management/AnnouncementsPage'));
const EquipmentPage = lazyWithRetry(() => import('./pages/management/EquipmentPage'));
const ContactsPage = lazyWithRetry(() => import('./pages/management/ContactsPage'));
const SubscriptionsPage = lazyWithRetry(() => import('./pages/office/SubscriptionsPage'));
const SchedulePage = lazyWithRetry(() => import('./pages/schedule/SchedulePage'));
const InboxPage = lazyWithRetry(() => import('./pages/inbox/InboxPage'));
const TodoPage = lazyWithRetry(() => import('./pages/todo/TodoPage'));
const AdminGamification = lazyWithRetry(() => import('./pages/admin/AdminGamification'));
const AdminProjectAnalyticsPage = lazyWithRetry(() => import('./pages/admin/AdminProjectAnalyticsPage'));
const ComponentsShowcase = lazyWithRetry(() => import('./pages/dev/ComponentsShowcase'));
const MainLayout = lazyWithRetry(() => import('./components/MainLayout'));

const LegacyWorkspaceRedirect = () => {
  const { name } = useParams();
  return <Navigate to={`/workspaces/${encodeURIComponent(name || '')}`} replace />;
};

function App() {
  React.useEffect(() => {
    const reqInterceptor = axios.interceptors.request.use((config) => {
      if (!config.headers['X-Trace-Id'] && !config.headers['x-trace-id']) {
        config.headers['X-Trace-Id'] = getClientTraceId();
      }
      return config;
    });

    const resInterceptor = axios.interceptors.response.use(
      (response) => {
        if (response.data != null) {
          response.data = normalizeProjectsInResponse(response.config?.url, response.data);
        }
        const method = response.config.method?.toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method) && shouldShowApiSuccessToast(response)) {
          const url = (response.config?.url || '').split('?')[0];
          const message = response.data.message;
          emitSystemEvent({
            severity: SEVERITY.SUCCESS,
            message,
            module: inferModuleFromRoute(url),
            id: slugId('api-ok', method, url),
          });
        }
        if (response.data?.traceId) {
          startClientTrace();
        }
        return response;
      },
      (error) => {
        const method = error.config?.method?.toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method) && shouldShowApiErrorToast(error)) {
          const url = (error.config?.url || '').split('?')[0];
          const { title, description, technicalError, errorCode, status, traceId } = parseErrorPayload(error);
          emitSystemEvent({
            severity: SEVERITY.ERROR,
            title,
            message: title,
            description,
            technicalError,
            errorCode,
            status,
            traceId: traceId || error.response?.headers?.['x-trace-id'] || getClientTraceId(),
            module: inferModuleFromRoute(url),
            timestamp: error.response?.data?.timestamp || new Date().toISOString(),
            id: slugId('api-err', method, url),
          });
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  return (
    <Suspense fallback={<AppBootFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/relegends" element={<OTPVerificationPage />} />
          <Route path="/auth/google/success" element={<GoogleSuccessPage />} />
          <Route path="/oauth/meta/callback" element={<MetaOAuthCallback />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/userdata" element={<UserDataDeletion />} />
          <Route path="/preview/artist/:id/*" element={<ArtistDetail isPreview={true} />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route element={<PageRoute page="dashboard" />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>
              <Route element={<PageRoute page="projects" />}>
                <Route path="/projects" element={<ProjectsView />} />
                <Route path="/projects/new" element={<ProjectCreate />} />
                <Route path="/workspaces/:name" element={<WorkspaceSettings />} />
                <Route path="/projects/workspaces/:name" element={<LegacyWorkspaceRedirect />} />
                <Route path="/projects/:id/analytics" element={<ProjectAnalyticsPage />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
              </Route>
              <Route element={<PageRoute page="calendar" />}>
                <Route path="/calendar" element={<CalendarView />} />
              </Route>
              <Route path="/settings" element={<SettingsPage />} />

              <Route element={<PageRoute page="logs" />}>
                <Route path="/logs" element={<DailyLogPage />} />
              </Route>
              <Route element={<PageRoute page="attendance" />}>
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/attendance/all" element={<AttendancePage />} />
              </Route>
              <Route element={<PageRoute page="schedule" />}>
                <Route path="/schedule" element={<SchedulePage />} />
              </Route>
              <Route element={<PageRoute page="inbox" />}>
                <Route path="/inbox" element={<InboxPage />} />
              </Route>
              <Route path="/chat" element={<Navigate to="/dashboard" replace />} />
              <Route path="/chat/*" element={<Navigate to="/dashboard" replace />} />
              <Route element={<PageRoute page="todo" />}>
                <Route path="/todo" element={<TodoPage />} />
              </Route>
              <Route element={<PageRoute page="admin_data" />}>
                <Route path="/components" element={<ComponentsShowcase />} />
              </Route>
              <Route element={<PageRoute page="equipment" />}>
                <Route path="/equipment" element={<EquipmentPage />} />
              </Route>
              <Route element={<PageRoute page="contacts" />}>
                <Route path="/contacts" element={<ContactsPage />} />
              </Route>
              <Route element={<PageRoute page="subscriptions" />}>
                <Route path="/subscriptions" element={<SubscriptionsPage />} />
              </Route>
              <Route path="/management/equipment" element={<Navigate to="/equipment" replace />} />
              <Route path="/management/contacts" element={<Navigate to="/contacts" replace />} />
              <Route path="/office/subscriptions" element={<Navigate to="/subscriptions" replace />} />
              <Route path="/management/attendance" element={<Navigate to="/attendance" replace />} />
              <Route element={<PageRoute page="assets" />}>
                <Route path="/assets" element={<AssetsPage />} />
              </Route>
              <Route path="/office-assets" element={<OfficeAssetsPage />} />
              <Route element={<PageRoute page="leads" />}>
                <Route path="/leads" element={<LeadsPage />} />
              </Route>
              <Route element={<PageRoute page="followups" />}>
                <Route path="/followups" element={<FollowupsPage />} />
              </Route>
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/workflows" element={<WorkflowCanvas />} />
              <Route element={<PageRoute page="bookings" />}>
                <Route path="/bookings" element={<ExlyBookingsPage />} />
              </Route>

              <Route element={<PageRoute page="admin_data" />}>
                <Route path="/admin" element={<AdminCRM />} />
                <Route path="/admin/control" element={<AdminPanel />} />
                <Route path="/admin/qa" element={<QATestingPage />} />
              </Route>
              <Route element={<PageRoute page="admin_users" />}>
                <Route path="/admin/users" element={<AdminUsers />} />
              </Route>
              <Route element={<PageRoute page="admin_exly" />}>
                <Route path="/admin/exly-campaigns" element={<ExlyCampaignsPage />} />
              </Route>
              <Route element={<PageRoute page="admin_data" />}>
                <Route path="/admin/audits" element={<Navigate to="/logs?view=lead-audits" replace />} />
              </Route>
              <Route element={<PageRoute page="admin_scripts" />}>
                <Route path="/admin/scripts" element={<AdminScriptsPage />} />
              </Route>
              <Route element={<PageRoute page="admin_gamification" />}>
                <Route path="/admin/gamification" element={<AdminGamification />} />
              </Route>
              <Route element={<PageRoute page="admin_project_analytics" />}>
                <Route path="/admin/project-analytics" element={<AdminProjectAnalyticsPage />} />
              </Route>
              <Route element={<PageRoute page="campaigns" />}>
                <Route path="/campaign/:campaignId" element={<CampaignDetails />} />
              </Route>
              <Route element={<PageRoute page="emails" />}>
                <Route path="/emails" element={<EmailsPage />} />
                <Route path="/emails/create" element={<CreateCampaignPage />} />
              </Route>
              <Route path="/workspace/emails" element={<Navigate to="/emails" replace />} />
              <Route path="/workspace/emails/create" element={<Navigate to="/emails/create" replace />} />

              <Route element={<PageRoute page="artists" />}>
                <Route path="/artists" element={<ArtistsCollection />} />
                <Route path="/artists/:id/*" element={<ArtistDetail />} />
              </Route>

              <Route element={<PageRoute page="finance" />}>
                <Route path="/finance" element={<FinancePage />} />
              </Route>
              <Route element={<PageRoute page="announcements" />}>
                <Route path="/announcements" element={<AnnouncementsPage />} />
              </Route>
              <Route element={<PageRoute page="ops_logs" />}>
                <Route path="/ops-logs" element={<SystemLogsPage />} />
              </Route>
              <Route path="/management/announcements" element={<Navigate to="/announcements" replace />} />
              <Route path="/management/ops-logs" element={<Navigate to="/ops-logs" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
  );
}

export default App;
