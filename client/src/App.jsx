import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { isClerkConfigured } from './config/clerk';
import { isAppSite, isAuthSite, isLandingSite } from './config/siteMode';
import ProtectedRoute from './components/ProtectedRoute';
import PageRoute from './components/PageRoute';
import ArtistOrAdminRoute from './components/ArtistOrAdminRoute';
import AppBootError from './components/AppBootError';
import BootScreen from './components/BootScreen';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import WithClerkWhenConfigured from './components/auth/WithClerkWhenConfigured';
import { createLazyWithRetry } from './utils/lazyWithRetry';
import ExternalAuthRedirect from './components/ExternalAuthRedirect';
import ExternalLandingRedirect from './components/ExternalLandingRedirect';
import { usesExternalAuthHost, usesExternalLandingHost } from './config/siteUrls';

const lazyWithRetry = createLazyWithRetry;

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
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'));
const AdminTeamsPage = lazyWithRetry(() => import('./pages/admin/AdminTeamsPage'));
const AdminRolesPage = lazyWithRetry(() => import('./pages/admin/AdminRolesPage'));
const AdminExly = lazyWithRetry(() => import('./pages/admin/AdminExly'));
const AdminCRM = lazyWithRetry(() => import('./pages/admin/AdminCRM'));
const CalendarView = lazyWithRetry(() => import('./pages/calendar/CalendarView'));
const SettingsPage = lazyWithRetry(() => import('./pages/settings/SettingsPage'));

const DailyLogPage = lazyWithRetry(() => import('./pages/productivity/DailyLogPage'));
const AdminScriptsPage = lazyWithRetry(() => import('./pages/admin/AdminScriptsPage'));
const AdminGamification = lazyWithRetry(() => import('./pages/admin/AdminGamification'));
const AssetsPage = lazyWithRetry(() => import('./pages/assets/AssetsPage'));
const AssetsHubLayout = lazyWithRetry(() => import('./pages/assets/AssetsHubLayout'));
const OrgAccountsPage = lazyWithRetry(() => import('./pages/assets/OrgAccountsPage'));
const LeadsPage = lazyWithRetry(() => import('./pages/crm/LeadsPage'));
const FollowupsPage = lazyWithRetry(() => import('./pages/crm/FollowupsPage'));
const FeaturesPage = lazyWithRetry(() => import('./pages/marketing/FeaturesPage'));
const GoogleSuccessPage = lazyWithRetry(() => import('./pages/auth/GoogleSuccessPage'));
const ArtistsCollection = lazyWithRetry(() => import('./pages/artists/ArtistsCollection'));
const ArtistDetail = lazyWithRetry(() => import('./pages/artists/ArtistDetail'));
const ArtistWorkspaceDetail = lazyWithRetry(() => import('./pages/artists/workspace/ArtistWorkspaceDetail'));
const ArtistWorkspaceShell = lazyWithRetry(() => import('./pages/artists/workspace/ArtistWorkspaceShell'));
const PortfolioDashboard = lazyWithRetry(() => import('./pages/artists/PortfolioDashboard'));
const ArtistPublicProfile = lazyWithRetry(() => import('./pages/artists/ArtistPublicProfile'));
const ArtistMembershipRoute = lazyWithRetry(() => import('./components/ArtistMembershipRoute'));
const ArtistMembershipAccept = lazyWithRetry(() => import('./pages/artists/workspace/ArtistMembershipAccept'));
const UnsubscribePage = lazyWithRetry(() => import('./pages/Unsubscribe'));
const CampaignDetails = lazyWithRetry(() => import('./pages/CampaignDetails'));
const WorkflowCanvas = lazyWithRetry(() => import('./pages/productivity/WorkflowCanvas'));
const OfficeAssetsPage = lazyWithRetry(() => import('./pages/office/OfficeAssetsPage'));
const MetaOAuthCallback = lazyWithRetry(() => import('./pages/auth/MetaOAuthCallback'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/legal/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./pages/legal/TermsOfService'));
const UserDataDeletion = lazyWithRetry(() => import('./pages/legal/UserDataDeletion'));
const OrgPickerPage = lazyWithRetry(() => import('./pages/org/OrgPickerPage'));
const CreateOrganizationPage = lazyWithRetry(() => import('./pages/org/CreateOrganizationPage'));
const OrgCreateSuccessPage = lazyWithRetry(() => import('./pages/org/OrgCreateSuccessPage'));
const TenantInviteAcceptPage = lazyWithRetry(() => import('./pages/org/TenantInviteAcceptPage'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const FinancePage = lazyWithRetry(() => import('./pages/finance/FinancePage'));
const ExlyCampaignsPage = lazyWithRetry(() => import('./pages/admin/ExlyCampaignsPage'));
const ExlyBookingsPage = lazyWithRetry(() => import('./pages/crm/ExlyBookingsPage'));
const EmailHubLayout = lazyWithRetry(() => import('./pages/emails/EmailHubLayout'));
const EmailsOverviewPage = lazyWithRetry(() => import('./pages/emails/EmailsOverviewPage'));
const EmailsCampaignsPage = lazyWithRetry(() => import('./pages/emails/EmailsCampaignsPage'));
const EmailsTemplatesPage = lazyWithRetry(() => import('./pages/emails/EmailsTemplatesPage'));
const EmailsProfilesPage = lazyWithRetry(() => import('./pages/emails/EmailsProfilesPage'));
const EmailsStreamsPage = lazyWithRetry(() => import('./pages/emails/EmailsStreamsPage'));
const EmailsAnalyticsPage = lazyWithRetry(() => import('./pages/emails/EmailsAnalyticsPage'));
const NewsletterPage = lazyWithRetry(() => import('./pages/workspace/NewsletterPage'));
const NewsletterCuratePage = lazyWithRetry(() => import('./pages/workspace/NewsletterCuratePage'));
const NewsletterSendPage = lazyWithRetry(() => import('./pages/workspace/NewsletterSendPage'));
const CreateCampaignPage = lazyWithRetry(() => import('./pages/workspace/CreateCampaignPage'));
const OTPVerificationPage = lazyWithRetry(() => import('./pages/auth/OTPVerificationPage'));
const OrgChoosePage = lazyWithRetry(() => import('./pages/auth/OrgChoosePage'));
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
import ArtistPathPage from './pages/admin/ArtistPathPage';
const AdminPlatformSettings = lazyWithRetry(() => import('./pages/admin/AdminPlatformSettings'));
const AdminProjectAnalyticsPage = lazyWithRetry(() => import('./pages/admin/AdminProjectAnalyticsPage'));
const MediaListPage = lazyWithRetry(() => import('./pages/admin/MediaListPage'));
const LeadAuditsPage = lazyWithRetry(() => import('./pages/admin/LeadAuditsPage'));
const SecurityAuditPage = lazyWithRetry(() => import('./pages/admin/SecurityAuditPage'));
const AdminTenantSsoPage = lazyWithRetry(() => import('./pages/admin/AdminTenantSsoPage'));
const AuditLogPage = lazyWithRetry(() => import('./pages/admin/AuditLogPage'));
const DevelopersPage = lazyWithRetry(() => import('./pages/settings/DevelopersPage'));
const CrmStatsPage = lazyWithRetry(() => import('./pages/admin/CrmStatsPage'));
const OpsHubPage = lazyWithRetry(() => import('./pages/admin/OpsHubPage'));
const KnowledgeEnginePage = lazyWithRetry(() => import('./pages/admin/KnowledgeEnginePage'));
const ComponentsShowcase = lazyWithRetry(() => import('./pages/dev/ComponentsShowcase'));
const CrmHub = lazyWithRetry(() => import('./pages/hubs/CrmHub'));
const OfficeHub = lazyWithRetry(() => import('./pages/hubs/OfficeHub'));
const ManagementHub = lazyWithRetry(() => import('./pages/hubs/ManagementHub'));
const AdminConsole = lazyWithRetry(() => import('./pages/hubs/AdminConsole'));
const MainLayout = lazyWithRetry(() => import('./components/MainLayout'));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'));

const LegacyWorkspaceRedirect = () => {
  const { name } = useParams();
  return <Navigate to={`/workspaces/${encodeURIComponent(name || '')}`} replace />;
};

const LegacyArtistAnalyticsRedirect = () => {
  const { id, platform } = useParams();
  const isPreview = window.location.pathname.startsWith('/preview/artist/');
  const base = isPreview ? `/preview/artist/${id}` : `/artists/${id}`;
  const target = platform
    ? `${base}?tab=analytics&platform=${encodeURIComponent(platform)}`
    : `${base}?tab=analytics`;
  return <Navigate to={target} replace />;
};

function AppRootRedirectInner({ clerkLoaded, clerkSignedIn }) {
  const { user, loading, bootError, retryBoot } = useAuth();

  const clerkSessionPending = isClerkConfigured()
    && clerkLoaded
    && clerkSignedIn
    && !user
    && !bootError;

  const clerkBoot = isClerkConfigured() && !clerkLoaded;

  if (bootError) {
    return <AppBootError bootError={bootError} onRefresh={() => retryBoot()} />;
  }

  if (loading || clerkBoot || clerkSessionPending) {
    return <BootScreen onRefresh={() => retryBoot()} />;
  }

  if (user) return <Navigate to="/dashboard" replace />;

  if (usesExternalLandingHost()) {
    return <ExternalLandingRedirect />;
  }

  return <Navigate to="/landing" replace />;
}

function AppRootRedirect() {
  return (
    <WithClerkWhenConfigured>
      {({ isLoaded: clerkLoaded, isSignedIn: clerkSignedIn }) => (
        <AppRootRedirectInner
          clerkLoaded={clerkLoaded}
          clerkSignedIn={clerkSignedIn}
        />
      )}
    </WithClerkWhenConfigured>
  );
}

const externalAuthRouteElements = (
  <>
    <Route path="/login" element={<ExternalAuthRedirect />} />
    <Route path="/register" element={<ExternalAuthRedirect />} />
    <Route path="/forgot-password" element={<ExternalAuthRedirect />} />
    <Route path="/reset-password" element={<ExternalAuthRedirect />} />
    <Route path="/relegends" element={<ExternalAuthRedirect />} />
    <Route path="/auth/google/success" element={<ExternalAuthRedirect />} />
  </>
);

const marketingAuthRoutes = (
  <>
    <Route path="/login/choose" element={<OrgChoosePage />} />
    <Route path="/login/*" element={<LoginPage />} />
    <Route path="/register/*" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/relegends" element={<OTPVerificationPage />} />
    <Route path="/auth/google/success" element={<GoogleSuccessPage />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/userdata" element={<UserDataDeletion />} />
  </>
);

function App() {
  React.useEffect(() => {
    let teardown;
    import('./lib/setupAxiosInterceptors').then(({ setupAxiosInterceptors }) => {
      teardown = setupAxiosInterceptors();
    });
    return () => teardown?.();
  }, []);

  return (
    <Suspense fallback={<BootScreen />}>
      <RouteErrorBoundary>
        <Routes>
          {isLandingSite() && (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/userdata" element={<UserDataDeletion />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}

          {isAuthSite() && (
            <>
              {marketingAuthRoutes}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}

          {isAppSite() && (
            <>
          <Route path="/" element={<AppRootRedirect />} />
          {usesExternalLandingHost() ? (
            <Route path="/landing" element={<ExternalLandingRedirect />} />
          ) : (
            <Route path="/landing" element={<LandingPage />} />
          )}
          {usesExternalAuthHost() ? (
            <>
              {externalAuthRouteElements}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/userdata" element={<UserDataDeletion />} />
            </>
          ) : (
            marketingAuthRoutes
          )}
          <Route path="/oauth/meta/callback" element={<MetaOAuthCallback />} />
          <Route path="/preview/artist/:id/analytics/:platform" element={<LegacyArtistAnalyticsRedirect />} />
          <Route path="/preview/artist/:id/analytics" element={<LegacyArtistAnalyticsRedirect />} />
          <Route path="/preview/artist/:id/*" element={<ArtistDetail isPreview={true} />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/artist/:slug" element={<ArtistPublicProfile />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/org/pick" element={<OrgPickerPage />} />
            <Route path="/org/create" element={<CreateOrganizationPage />} />
            <Route path="/org/create/success" element={<OrgCreateSuccessPage />} />
            <Route path="/invites/:token/accept" element={<TenantInviteAcceptPage />} />
            <Route path="/artist-workspace/:id/accept" element={<ArtistMembershipAccept />} />
            <Route
              path="/artist-workspace/:id/*"
              element={(
                <ArtistMembershipRoute>
                  <ArtistWorkspaceShell>
                    <ArtistWorkspaceDetail />
                  </ArtistWorkspaceShell>
                </ArtistMembershipRoute>
              )}
            />
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
              <Route element={<PageRoute page="settings" />}>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/profile" element={<Navigate to="/settings?tab=profile" replace />} />
                <Route path="/developers" element={<DevelopersPage />} />
              </Route>
              <Route path="/org/settings" element={<Navigate to="/settings?tab=organization" replace />} />

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
              <Route element={<PageRoute pages={['finance', 'announcements', 'org_documents', 'artists']} />}>
                <Route path="/management" element={<ManagementHub />} />
              </Route>
              <Route element={<PageRoute pages={['admin_users', 'admin_teams', 'admin_data', 'admin_artist_path', 'admin_exly', 'admin_scripts', 'admin_gamification', 'admin_project_analytics', 'admin_roles']} />}>
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
              <Route path="/documents" element={<Navigate to="/management?tab=documents" replace />} />
              <Route path="/management/announcements" element={<Navigate to="/management?tab=announcements" replace />} />
              <Route path="/artists" element={<Navigate to="/management?tab=artists" replace />} />

              <Route element={<PageRoute page="assets" />}>
                <Route element={<AssetsHubLayout />}>
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route element={<ArtistOrAdminRoute />}>
                    <Route path="/assets/accounts" element={<OrgAccountsPage />} />
                  </Route>
                </Route>
              </Route>
              <Route element={<PageRoute page="office_assets" />}>
                <Route path="/office-assets" element={<OfficeAssetsPage />} />
              </Route>
              <Route element={<PageRoute page="features" />}>
                <Route path="/features" element={<FeaturesPage />} />
              </Route>
              <Route element={<PageRoute page="workflows" />}>
                <Route path="/workflows" element={<WorkflowCanvas />} />
              </Route>

              <Route element={<PageRoute pages={['admin_data', 'admin_artist_path']} />}>
                <Route path="/admin/artist-path" element={<ArtistPathPage />} />
              </Route>
              <Route element={<PageRoute page="admin_data" />}>
                <Route path="/admin" element={<AdminCRM />} />
                <Route path="/admin/control" element={<AdminPanel />} />
                <Route path="/admin/qa" element={<QATestingPage />} />
                <Route path="/admin/media-list" element={<MediaListPage />} />
                <Route path="/admin/lead-audits" element={<LeadAuditsPage />} />
                <Route path="/admin/security-audit" element={<SecurityAuditPage />} />
                <Route path="/admin/crm-stats" element={<CrmStatsPage />} />
                <Route path="/admin/audits" element={<Navigate to="/admin/lead-audits" replace />} />
              </Route>
              <Route element={<PageRoute page="admin_users" />}>
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/platform-settings" element={<AdminPlatformSettings />} />
                <Route path="/admin/tenant-sso" element={<AdminTenantSsoPage />} />
                <Route path="/admin/audit-log" element={<AuditLogPage />} />
              </Route>
              <Route element={<PageRoute page="admin_teams" />}>
                <Route path="/admin/teams" element={<AdminTeamsPage />} />
              </Route>
              <Route element={<PageRoute page="admin_roles" />}>
                <Route path="/admin/roles" element={<AdminRolesPage />} />
              </Route>
              <Route element={<PageRoute page="admin_exly" />}>
                <Route path="/admin/exly-campaigns" element={<ExlyCampaignsPage />} />
              </Route>
              <Route element={<PageRoute page="admin_scripts" />}>
                <Route path="/admin/scripts" element={<AdminScriptsPage />} />
              </Route>
              <Route element={<PageRoute page="admin_gamification" />}>
                <Route path="/admin/gamification" element={<AdminGamification />} />
              </Route>
              <Route element={<PageRoute page="admin_ops_hub" />}>
                <Route path="/admin/ops-hub" element={<OpsHubPage />} />
              </Route>
              <Route element={<PageRoute pages={['admin_knowledge_engine', 'admin_data']} />}>
                <Route path="/admin/knowledge-engine" element={<KnowledgeEnginePage />} />
              </Route>
              <Route element={<PageRoute page="admin_project_analytics" />}>
                <Route path="/admin/project-analytics" element={<AdminProjectAnalyticsPage />} />
              </Route>
              <Route element={<PageRoute page="emails" />}>
                <Route path="/campaign/:campaignId" element={<CampaignDetails />} />
                <Route element={<EmailHubLayout />}>
                  <Route path="/emails" element={<EmailsOverviewPage />} />
                  <Route path="/emails/campaigns" element={<EmailsCampaignsPage />} />
                  <Route path="/emails/templates" element={<EmailsTemplatesPage />} />
                  <Route path="/emails/profiles" element={<EmailsProfilesPage />} />
                  <Route path="/emails/streams" element={<EmailsStreamsPage />} />
                  <Route path="/emails/analytics" element={<EmailsAnalyticsPage />} />
                  <Route path="/emails/newsletter" element={<NewsletterPage />} />
                  <Route path="/emails/newsletter/curate" element={<NewsletterCuratePage />} />
                  <Route path="/emails/newsletter/send/:issueId" element={<NewsletterSendPage />} />
                </Route>
                <Route path="/emails/create" element={<CreateCampaignPage />} />
              </Route>
              <Route path="/workspace/emails" element={<Navigate to="/emails" replace />} />
              <Route path="/workspace/emails/create" element={<Navigate to="/emails/create" replace />} />

              <Route element={<PageRoute page="artists" />}>
                <Route path="/artists/portfolio" element={<PortfolioDashboard />} />
                <Route path="/artists/:id/analytics/:platform" element={<LegacyArtistAnalyticsRedirect />} />
                <Route path="/artists/:id/analytics" element={<LegacyArtistAnalyticsRedirect />} />
                <Route path="/artists/:id/*" element={<ArtistDetail />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </RouteErrorBoundary>
    </Suspense>
  );
}

export default App;
