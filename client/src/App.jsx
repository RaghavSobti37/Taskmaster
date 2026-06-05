import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PageRoute from './components/PageRoute';
import AppBootFallback from './components/AppBootFallback';
import RouteErrorBoundary from './components/RouteErrorBoundary';

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
const AdminTeamsPage = lazyWithRetry(() => import('./pages/admin/AdminTeamsPage'));
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
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
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
const NotesPage = lazyWithRetry(() => import('./pages/notes/NotesPage'));
const NoteEditorPage = lazyWithRetry(() => import('./pages/notes/NoteEditorPage'));
const AdminGamification = lazyWithRetry(() => import('./pages/admin/AdminGamification'));
const AdminProjectAnalyticsPage = lazyWithRetry(() => import('./pages/admin/AdminProjectAnalyticsPage'));
const ComponentsShowcase = lazyWithRetry(() => import('./pages/dev/ComponentsShowcase'));
const CrmHub = lazyWithRetry(() => import('./pages/hubs/CrmHub'));
const OfficeHub = lazyWithRetry(() => import('./pages/hubs/OfficeHub'));
const ManagementHub = lazyWithRetry(() => import('./pages/hubs/ManagementHub'));
const AdminConsole = lazyWithRetry(() => import('./pages/hubs/AdminConsole'));
const MainLayout = lazyWithRetry(() => import('./components/MainLayout'));

const LegacyWorkspaceRedirect = () => {
  const { name } = useParams();
  return <Navigate to={`/workspaces/${encodeURIComponent(name || '')}`} replace />;
};

function App() {
  React.useEffect(() => {
    let teardown;
    import('./lib/setupAxiosInterceptors').then(({ setupAxiosInterceptors }) => {
      teardown = setupAxiosInterceptors();
    });
    return () => teardown?.();
  }, []);

  return (
    <Suspense fallback={<AppBootFallback />}>
      <RouteErrorBoundary>
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
              <Route element={<PageRoute page="notes" />}>
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/notes/new" element={<NotesPage />} />
                <Route path="/notes/:id" element={<NoteEditorPage />} />
              </Route>
              <Route element={<PageRoute page="admin_data" />}>
                <Route path="/components" element={<ComponentsShowcase />} />
              </Route>
              <Route path="/management/equipment" element={<Navigate to="/office?tab=equipment" replace />} />
              <Route path="/management/contacts" element={<Navigate to="/office?tab=contacts" replace />} />
              <Route path="/office/subscriptions" element={<Navigate to="/office?tab=subscriptions" replace />} />
              <Route path="/management/attendance" element={<Navigate to="/attendance" replace />} />
              <Route element={<PageRoute pages={['leads', 'followups', 'bookings']} />}>
                <Route path="/crm" element={<CrmHub />} />
              </Route>
              <Route element={<PageRoute pages={['equipment', 'contacts', 'subscriptions']} />}>
                <Route path="/office" element={<OfficeHub />} />
              </Route>
              <Route element={<PageRoute pages={['finance', 'announcements', 'ops_logs', 'artists']} />}>
                <Route path="/management" element={<ManagementHub />} />
              </Route>
              <Route element={<PageRoute pages={['admin_users', 'admin_data', 'admin_exly', 'admin_scripts', 'admin_gamification', 'admin_project_analytics']} />}>
                <Route path="/admin/console" element={<AdminConsole />} />
              </Route>
              <Route path="/leads" element={<Navigate to="/crm?tab=leads" replace />} />
              <Route path="/followups" element={<Navigate to="/crm?tab=followups" replace />} />
              <Route path="/bookings" element={<Navigate to="/crm?tab=bookings" replace />} />
              <Route path="/equipment" element={<Navigate to="/office?tab=equipment" replace />} />
              <Route path="/contacts" element={<Navigate to="/office?tab=contacts" replace />} />
              <Route path="/subscriptions" element={<Navigate to="/office?tab=subscriptions" replace />} />
              <Route path="/finance" element={<Navigate to="/management?tab=finance" replace />} />
              <Route path="/announcements" element={<Navigate to="/management?tab=announcements" replace />} />
              <Route path="/ops-logs" element={<Navigate to="/management?tab=ops-logs" replace />} />
              <Route path="/management/ops-logs" element={<Navigate to="/management?tab=ops-logs" replace />} />
              <Route path="/management/announcements" element={<Navigate to="/management?tab=announcements" replace />} />
              <Route path="/artists" element={<Navigate to="/management?tab=artists" replace />} />

              <Route element={<PageRoute page="assets" />}>
                <Route path="/assets" element={<AssetsPage />} />
              </Route>
              <Route path="/office-assets" element={<OfficeAssetsPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/workflows" element={<WorkflowCanvas />} />

              <Route element={<PageRoute page="admin_data" />}>
                <Route path="/admin" element={<AdminCRM />} />
                <Route path="/admin/control" element={<AdminPanel />} />
                <Route path="/admin/qa" element={<QATestingPage />} />
              </Route>
              <Route element={<PageRoute page="admin_users" />}>
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/teams" element={<AdminTeamsPage />} />
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
                <Route path="/artists/:id/*" element={<ArtistDetail />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteErrorBoundary>
    </Suspense>
  );
}

export default App;
