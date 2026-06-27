/** Canonical 3-zone navbar structure for the app sidebar. */

export const LEGACY_NAV_GROUP_IDS = new Set(['platform', 'workspace', 'office', 'crm', 'management', 'admin']);

export const HUB_CONFIG = {
  '/crm': {
    label: 'CRM',
    accessKey: 'crm_hub',
    childKeys: ['leads', 'followups', 'bookings'],
    defaultTab: 'leads',
    tabs: [
      { id: 'leads', label: 'Leads', key: 'leads' },
      { id: 'followups', label: 'Followups', key: 'followups' },
      { id: 'bookings', label: 'Bookings', key: 'bookings' },
    ],
  },
  '/office': {
    label: 'People & Office',
    accessKey: 'office_hub',
    childKeys: ['equipment', 'contacts', 'subscriptions'],
    defaultTab: 'equipment',
    tabs: [
      { id: 'equipment', label: 'Equipment', key: 'equipment' },
      { id: 'contacts', label: 'Contacts', key: 'contacts' },
      { id: 'subscriptions', label: 'Subscriptions', key: 'subscriptions' },
    ],
  },
  '/management': {
    label: 'Management',
    accessKey: 'management_hub',
    childKeys: ['finance', 'announcements', 'ops_logs', 'artists'],
    defaultTab: 'ops_logs',
    tabs: [
      { id: 'finance', label: 'Finance', key: 'finance' },
      { id: 'announcements', label: 'Announcements', key: 'announcements' },
      { id: 'ops-logs', label: 'Ops Logs', key: 'ops_logs' },
      { id: 'artists', label: 'Artists', key: 'artists' },
    ],
  },
  '/admin/console': {
    label: 'Admin',
    accessKey: 'admin_console',
    childKeys: [
      'admin_users',
      'admin_teams',
      'admin_roles',
      'admin_data',
      'admin_ops_hub',
      'admin_artist_path',
      'admin_exly',
      'admin_scripts',
      'admin_gamification',
      'admin_project_analytics',
    ],
    tiles: [
      { id: 'users', label: 'Users', path: '/admin/users', key: 'admin_users', icon: 'Users' },
      { id: 'platform-settings', label: 'Platform settings', path: '/admin/platform-settings', key: 'admin_users', icon: 'Settings2' },
      { id: 'teams', label: 'Teams', path: '/admin/teams', key: 'admin_teams', icon: 'Building2' },
      { id: 'roles', label: 'Roles', path: '/admin/roles', key: 'admin_roles', icon: 'Shield' },
      { id: 'data-hub', label: 'Data Hub', path: '/admin', key: 'admin_data', icon: 'Database' },
      { id: 'ops-hub', label: 'Ops Hub', path: '/admin/ops-hub', key: 'admin_ops_hub', icon: 'Layers' },
      { id: 'media-list', label: 'Media List', path: '/admin/media-list', key: 'admin_data', icon: 'Newspaper' },
      { id: 'artist-path', label: 'Artist Path', path: '/admin/artist-path', key: 'admin_artist_path', icon: 'Music' },
      { id: 'exly', label: 'Exly Data', path: '/admin/exly-campaigns', key: 'admin_exly', icon: 'BarChart2' },
      { id: 'scripts', label: 'Script Runner', path: '/admin/scripts', key: 'admin_scripts', icon: 'Brackets' },
      { id: 'gamification', label: 'Gamification', path: '/admin/gamification', key: 'admin_gamification', icon: 'Trophy' },
      { id: 'project-analytics', label: 'Project Analytics', path: '/admin/project-analytics', key: 'admin_project_analytics', icon: 'BarChart3' },
      { id: 'qa', label: 'QA Testing', path: '/admin/qa', key: 'admin_data', icon: 'Activity' },
    ],
  },
};

/** Standalone child paths folded into hubs (excluded from default sidebar). */
const HUB_CHILD_PATHS = new Set([
  '/leads',
  '/followups',
  '/bookings',
  '/equipment',
  '/contacts',
  '/subscriptions',
  '/finance',
  '/announcements',
  '/ops-logs',
  '/artists',
  '/admin/users',
  '/admin/teams',
  '/admin/roles',
  '/admin',
  '/admin/media-list',
  '/admin/artist-path',
  '/admin/exly-campaigns',
  '/admin/scripts',
  '/admin/gamification',
  '/admin/project-analytics',
  '/admin/ops-hub',
  '/admin/qa',
]);

const PRIMARY_PATHS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/projects', label: 'Projects' },
  { path: '/todo', label: 'Todo' },
  { path: '/inbox', label: 'Inbox' },
  { path: '/attendance', label: 'Attendance' },
];

const TOOLS_PATHS = [
  { path: '/calendar', label: 'Calendar' },
  { path: '/logs', label: 'Daily Logs' },
  { path: '/notes', label: 'Notes' },
  { path: '/assets', label: 'Assets' },
  { path: '/schedule', label: 'Schedule' },
  { path: '/emails', label: 'Emails' },
];

const HUB_PATHS = [
  { path: '/crm', label: 'CRM' },
  { path: '/office', label: 'People & Office' },
  { path: '/management', label: 'Management' },
  { path: '/admin/console', label: 'Admin' },
];

function mapPages(pages) {
  return pages.map((page, idx) => ({
    path: page.path,
    label: page.label,
    order: idx + 1,
    visible: true,
  }));
}

export const DEFAULT_NAVBAR_GROUPS = [
  {
    id: 'primary',
    title: 'Primary',
    order: 1,
    visible: true,
    isCustom: false,
    flat: true,
    pages: mapPages(PRIMARY_PATHS),
  },
  {
    id: 'tools',
    title: 'Tools',
    order: 2,
    visible: true,
    isCustom: false,
    defaultOpen: true,
    pages: mapPages(TOOLS_PATHS),
  },
  {
    id: 'hubs',
    title: 'Modules',
    order: 3,
    visible: true,
    isCustom: false,
    defaultOpen: true,
    pages: mapPages(HUB_PATHS),
  },
];

/** Map legacy sidebar paths to new zone ids. */
const LEGACY_PATH_ZONE = {
  '/dashboard': 'primary',
  '/calendar': 'tools',
  '/todo': 'primary',
  '/inbox': 'primary',
  '/projects': 'primary',
  '/assets': 'tools',
  '/schedule': 'tools',
  '/logs': 'tools',
  '/emails': 'tools',
  '/attendance': 'primary',
  '/equipment': 'hubs',
  '/contacts': 'hubs',
  '/subscriptions': 'hubs',
  '/leads': 'hubs',
  '/followups': 'hubs',
  '/bookings': 'hubs',
  '/finance': 'hubs',
  '/announcements': 'hubs',
  '/ops-logs': 'hubs',
  '/artists': 'hubs',
  '/admin/users': 'hubs',
  '/admin/teams': 'hubs',
  '/admin': 'hubs',
  '/admin/exly-campaigns': 'hubs',
  '/admin/scripts': 'hubs',
  '/admin/gamification': 'hubs',
  '/admin/project-analytics': 'hubs',
  '/admin/qa': 'hubs',
};

function isLegacyNavbarGroups(groups) {
  return (groups || []).some((g) => LEGACY_NAV_GROUP_IDS.has(g.id));
}

/** Map sidebar paths to permission page keys — keep in sync with pagePermissions. */
const PATH_TO_PAGE_KEY = {
  '/dashboard': 'dashboard',
  '/projects': 'projects',
  '/todo': 'todo',
  '/inbox': 'inbox',
  '/attendance': 'attendance',
  '/calendar': 'calendar',
  '/logs': 'logs',
  '/notes': 'notes',
  '/assets': 'assets',
  '/schedule': 'schedule',
  '/emails': 'emails',
  '/settings': 'settings',
  '/office-assets': 'office_assets',
  '/features': 'features',
  '/workflows': 'workflows',
};

const HUB_TAB_PATHS = {
  leads: '/leads',
  followups: '/followups',
  bookings: '/bookings',
  equipment: '/equipment',
  contacts: '/contacts',
  subscriptions: '/subscriptions',
  finance: '/finance',
  announcements: '/announcements',
  ops_logs: '/ops-logs',
  artists: '/artists',
};

function pagesFromPaths(paths) {
  return paths.map((p) => ({
    key: PATH_TO_PAGE_KEY[p.path],
    label: p.label,
    path: p.path,
  })).filter((p) => p.key);
}

function pagesFromHub(hubPath) {
  const hub = HUB_CONFIG[hubPath];
  if (!hub?.tabs) return [];
  return hub.tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    path: HUB_TAB_PATHS[tab.key] || `${hubPath}?tab=${tab.id}`,
  }));
}

function pagesFromAdminConsole() {
  const hub = HUB_CONFIG['/admin/console'];
  const tiles = hub?.tiles || [];
  const pages = tiles.map((tile) => ({
    key: tile.key,
    label: tile.label,
    path: tile.path,
  }));
  pages.push(
    { key: 'ops_hub_academy', label: 'Ops Hub — Academy', path: '/admin/ops-hub' },
    { key: 'ops_hub_media', label: 'Ops Hub — Media', path: '/admin/ops-hub' },
    { key: 'ops_hub_show_booking', label: 'Ops Hub — Show Booking', path: '/admin/ops-hub' },
    { key: 'ops_hub_influencers', label: 'Ops Hub — Influencers', path: '/admin/ops-hub' },
    { key: 'campaigns', label: 'Campaign Details', path: '/campaign' },
  );
  return pages;
}

/** Permission UI groups aligned with 3-zone sidebar + hub tabs. */
export function buildPagePermissionGroups() {
  return [
    { id: 'primary', label: 'Primary', pages: pagesFromPaths(PRIMARY_PATHS) },
    { id: 'tools', label: 'Tools', pages: pagesFromPaths(TOOLS_PATHS) },
    { id: 'crm', label: HUB_CONFIG['/crm'].label, pages: pagesFromHub('/crm') },
    { id: 'office', label: HUB_CONFIG['/office'].label, pages: pagesFromHub('/office') },
    { id: 'management', label: HUB_CONFIG['/management'].label, pages: pagesFromHub('/management') },
    {
      id: 'app_tools',
      label: 'App Tools',
      pages: [
        { key: 'settings', label: 'Settings', path: '/settings' },
        { key: 'office_assets', label: 'Office Assets', path: '/office-assets' },
        { key: 'features', label: 'Features', path: '/features' },
        { key: 'workflows', label: 'Workflows', path: '/workflows' },
      ],
    },
    { id: 'admin', label: 'Admin', pages: pagesFromAdminConsole() },
  ];
}

function getHubPathForChildPath(path) {
  if (['/leads', '/followups', '/bookings'].includes(path)) return '/crm';
  if (['/equipment', '/contacts', '/subscriptions'].includes(path)) return '/office';
  if (['/finance', '/announcements', '/ops-logs', '/artists'].includes(path)) return '/management';
  if (path.startsWith('/admin')) return '/admin/console';
  return null;
}
