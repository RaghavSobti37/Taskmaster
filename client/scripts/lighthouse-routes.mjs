/**
 * Static app routes for Lighthouse audits (from App.jsx).
 * Dynamic segments (:id, :name, :campaignId) omitted — add via LH_ROUTES_EXTRA.
 */

export const PUBLIC_ROUTES = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/register', name: 'Register' },
  { path: '/forgot-password', name: 'Forgot password' },
  { path: '/reset-password', name: 'Reset password' },
  { path: '/relegends', name: 'OTP verification' },
  { path: '/auth/google/success', name: 'Google OAuth success' },
  { path: '/oauth/meta/callback', name: 'Meta OAuth callback' },
  { path: '/privacy', name: 'Privacy policy' },
  { path: '/userdata', name: 'User data deletion' },
  { path: '/unsubscribe', name: 'Unsubscribe' },
];

/** Requires authenticated session (cookie). Redirects to /login without auth. */
export const PROTECTED_ROUTES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/projects', name: 'Projects' },
  { path: '/projects/new', name: 'New project' },
  { path: '/calendar', name: 'Calendar' },
  { path: '/settings', name: 'Settings' },
  { path: '/logs', name: 'Daily logs' },
  { path: '/attendance', name: 'Attendance' },
  { path: '/attendance/all', name: 'Attendance (all)' },
  { path: '/schedule', name: 'Schedule' },
  { path: '/inbox', name: 'Inbox' },
  { path: '/todo', name: 'Todo' },
  { path: '/components', name: 'Components showcase' },
  { path: '/equipment', name: 'Equipment' },
  { path: '/contacts', name: 'Contacts' },
  { path: '/subscriptions', name: 'Subscriptions' },
  { path: '/assets', name: 'Assets' },
  { path: '/office-assets', name: 'Office assets' },
  { path: '/leads', name: 'Leads' },
  { path: '/followups', name: 'Follow-ups' },
  { path: '/features', name: 'Features' },
  { path: '/workflows', name: 'Workflows' },
  { path: '/bookings', name: 'Bookings' },
  { path: '/admin', name: 'Admin CRM' },
  { path: '/admin/control', name: 'Admin panel' },
  { path: '/admin/qa', name: 'QA testing' },
  { path: '/admin/users', name: 'Admin users' },
  { path: '/admin/exly-campaigns', name: 'Exly campaigns' },
  { path: '/admin/scripts', name: 'Admin scripts' },
  { path: '/admin/gamification', name: 'Gamification' },
  { path: '/admin/project-analytics', name: 'Project analytics' },
  { path: '/emails', name: 'Emails' },
  { path: '/emails/create', name: 'Create campaign' },
  { path: '/artists', name: 'Artists' },
  { path: '/finance', name: 'Finance' },
  { path: '/announcements', name: 'Announcements' },
];

export function resolveRoutes({ publicOnly, protectedOnly, extraPaths = [] }) {
  let routes = [];
  if (!protectedOnly) routes = routes.concat(PUBLIC_ROUTES);
  if (!publicOnly) routes = routes.concat(PROTECTED_ROUTES);

  for (const raw of extraPaths) {
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    routes.push({ path, name: path });
  }

  const seen = new Set();
  return routes.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}
