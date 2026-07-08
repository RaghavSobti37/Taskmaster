#!/usr/bin/env node
/**
 * Scans client/src/pages and emits docs/.generated/page-inventory.json
 * Used by COREKNOT_MASTER.md generation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'client/src/pages');

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (/\.(jsx|js|tsx|ts)$/.test(e.name)) files.push(p);
  }
  return files;
}

const apiRe = /['"`](\/api\/[^'"`\s]+)['"`]/g;
const hookRe = /\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g;
const exportFnRe = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
const exportConstRe = /export\s+const\s+([A-Za-z0-9_]+)\s*=/g;
const importCompRe = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]\.\.\/(?:\.\.\/)?components\//g;

const ROUTE_MAP = {
  'pages/Dashboard.jsx': ['/dashboard'],
  'pages/auth/OrgChoosePage.jsx': ['/login/choose'],
  'pages/auth/LoginPage.jsx': ['/login/*'],
  'pages/auth/RegisterPage.jsx': ['/register/*'],
  'pages/auth/ForgotPasswordPage.jsx': ['/forgot-password'],
  'pages/auth/ResetPasswordPage.jsx': ['/reset-password'],
  'pages/auth/GoogleSuccessPage.jsx': ['/auth/google/success'],
  'pages/auth/MetaOAuthCallback.jsx': ['/oauth/meta/callback'],
  'pages/LandingPage.jsx': ['/', '/landing'],
  'pages/legal/PrivacyPolicy.jsx': ['/privacy'],
  'pages/legal/UserDataDeletion.jsx': ['/userdata'],
  'pages/Unsubscribe.jsx': ['/unsubscribe'],
  'pages/NotFoundPage.jsx': ['* (in MainLayout)'],
  'pages/projects/ProjectsView.jsx': ['/projects'],
  'pages/projects/ProjectCreate.jsx': ['/projects/new'],
  'pages/projects/ProjectDetail.jsx': ['/projects/:id'],
  'pages/projects/ProjectAnalyticsPage.jsx': ['/projects/:id/analytics'],
  'pages/projects/WorkspaceSettings.jsx': ['/workspaces/:name'],
  'pages/org/OrgPickerPage.jsx': ['/org/pick'],
  'pages/org/CreateOrganizationPage.jsx': ['/org/create'],
  'pages/org/OrgCreateSuccessPage.jsx': ['/org/create/success'],
  'pages/org/TenantInviteAcceptPage.jsx': ['/invites/:token/accept'],
  'pages/calendar/CalendarView.jsx': ['/calendar'],
  'pages/settings/SettingsPage.jsx': ['/settings'],
  'pages/settings/DevelopersPage.jsx': ['/developers'],
  'pages/productivity/DailyLogPage.jsx': ['/logs'],
  'pages/management/AttendancePage.jsx': ['/attendance', '/attendance/all'],
  'pages/schedule/SchedulePage.jsx': ['/schedule'],
  'pages/inbox/InboxPage.jsx': ['/inbox'],
  'pages/todo/TodoPage.jsx': ['/todo'],
  'pages/notes/NotesPage.jsx': ['/notes', '/notes/new'],
  'pages/notes/NoteEditorPage.jsx': ['/notes/:id'],
  'pages/hubs/CrmHub.jsx': ['/crm?tab=leads|followups|bookings'],
  'pages/hubs/OfficeHub.jsx': ['/office?tab=equipment|contacts|subscriptions'],
  'pages/hubs/ManagementHub.jsx': ['/management?tab=finance|announcements|documents|artists'],
  'pages/hubs/AdminConsole.jsx': ['/admin/console'],
  'pages/crm/LeadsPage.jsx': ['(tab: leads)'],
  'pages/crm/FollowupsPage.jsx': ['(tab: followups)'],
  'pages/crm/ExlyBookingsPage.jsx': ['(tab: bookings)'],
  'pages/crm/ArtistBookingEnquiriesPage.jsx': ['(CRM sub)'],
  'pages/management/EquipmentPage.jsx': ['(tab: equipment)'],
  'pages/management/ContactsPage.jsx': ['(tab: contacts)'],
  'pages/office/SubscriptionsPage.jsx': ['(tab: subscriptions)'],
  'pages/finance/FinancePage.jsx': ['(tab: finance)'],
  'pages/management/AnnouncementsPage.jsx': ['(tab: announcements)'],
  'pages/artists/ArtistsCollection.jsx': ['(tab: artists)'],
  'pages/assets/AssetsPage.jsx': ['/assets'],
  'pages/assets/OrgAccountsPage.jsx': ['/assets/accounts'],
  'pages/office/OfficeAssetsPage.jsx': ['/office-assets'],
  'pages/marketing/FeaturesPage.jsx': ['/features'],
  'pages/productivity/WorkflowCanvas.jsx': ['/workflows'],
  'pages/dev/ComponentsShowcase.jsx': ['/components'],
  'pages/admin/ArtistPathPage.jsx': ['/admin/artist-path'],
  'pages/admin/AdminCRM.jsx': ['/admin'],
  'pages/admin/AdminPanel.jsx': ['/admin/control'],
  'pages/admin/QATestingPage.jsx': ['/admin/qa'],
  'pages/admin/MediaListPage.jsx': ['/admin/media-list'],
  'pages/admin/LeadAuditsPage.jsx': ['/admin/lead-audits'],
  'pages/admin/CrmStatsPage.jsx': ['/admin/crm-stats'],
  'pages/admin/AdminUsers.jsx': ['/admin/users'],
  'pages/admin/AdminPlatformSettings.jsx': ['/admin/platform-settings'],
  'pages/admin/AdminTeamsPage.jsx': ['/admin/teams'],
  'pages/admin/AdminRolesPage.jsx': ['/admin/roles'],
  'pages/admin/ExlyCampaignsPage.jsx': ['/admin/exly-campaigns'],
  'pages/admin/AdminScriptsPage.jsx': ['/admin/scripts'],
  'pages/admin/AdminGamification.jsx': ['/admin/gamification'],
  'pages/admin/OpsHubPage.jsx': ['/admin/ops-hub'],
  'pages/admin/AdminProjectAnalyticsPage.jsx': ['/admin/project-analytics'],
  'pages/admin/SecurityAuditPage.jsx': ['/admin/security-audit'],
  'pages/admin/AdminTenantSsoPage.jsx': ['/admin/tenant-sso'],
  'pages/admin/DataHubPage.jsx': ['(AdminCRM tab)'],
  'pages/CampaignDetails.jsx': ['/campaign/:campaignId'],
  'pages/emails/EmailsOverviewPage.jsx': ['/emails'],
  'pages/emails/EmailsCampaignsPage.jsx': ['/emails/campaigns'],
  'pages/emails/EmailsTemplatesPage.jsx': ['/emails/templates'],
  'pages/emails/EmailsProfilesPage.jsx': ['/emails/profiles'],
  'pages/emails/EmailsStreamsPage.jsx': ['/emails/streams'],
  'pages/workspace/NewsletterPage.jsx': ['/emails/newsletter'],
  'pages/workspace/NewsletterCuratePage.jsx': ['/emails/newsletter/curate'],
  'pages/workspace/NewsletterSendPage.jsx': ['/emails/newsletter/send/:issueId'],
  'pages/workspace/CreateCampaignPage.jsx': ['/emails/create'],
  'pages/artists/PortfolioDashboard.jsx': ['/artists/portfolio'],
  'pages/artists/ArtistDetail.jsx': ['/artists/:id/*', '/preview/artist/:id/*'],
  'pages/artists/ArtistPublicProfile.jsx': ['/artist/:slug'],
  'pages/artists/workspace/ArtistMembershipAccept.jsx': ['/artist-workspace/:id/accept'],
  'pages/artists/workspace/ArtistWorkspaceShell.jsx': ['/artist-workspace/:id/* (shell)'],
  'pages/artists/workspace/ArtistWorkspaceDetail.jsx': ['(workspace routes)'],
};

const files = walk(pagesDir);
const results = [];

for (const abs of files.sort()) {
  const rel = path.relative(path.join(root, 'client/src'), abs).replace(/\\/g, '/');
  const content = fs.readFileSync(abs, 'utf8');
  const apis = [...new Set([...content.matchAll(apiRe)].map((m) => m[1]))].sort();
  const hooks = [...new Set([...content.matchAll(hookRe)].map((m) => m[1]))]
    .filter((h) => h.startsWith('use'))
    .sort();
  const exports = [
    ...[...content.matchAll(exportFnRe)].map((m) => m[1]),
    ...[...content.matchAll(exportConstRe)].map((m) => m[1]),
  ];
  const defaultMatch = content.match(/export\s+default\s+([A-Za-z0-9_]+)/);
  const comps = [...new Set([...content.matchAll(importCompRe)].map((m) => m[1]))].sort();
  results.push({
    file: `client/src/${rel}`,
    routes: ROUTE_MAP[rel] || [],
    lines: content.split('\n').length,
    defaultExport: defaultMatch ? defaultMatch[1] : null,
    namedExports: [...new Set(exports)],
    hooks,
    apis,
    components: comps,
  });
}

const outDir = path.join(root, 'docs/.generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'page-inventory.json'), JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} pages to docs/.generated/page-inventory.json`);
