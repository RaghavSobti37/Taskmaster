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
    label: 'Office',
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
    childKeys: ['finance', 'announcements', 'org_documents', 'artists'],
    defaultTab: 'finance',
    tabs: [
      { id: 'finance', label: 'Finance', key: 'finance' },
      { id: 'announcements', label: 'Announcements', key: 'announcements' },
      { id: 'documents', label: 'Documents', key: 'org_documents' },
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
      'admin_developers',
    ],
    tiles: [
      {
        id: 'users',
        label: 'Users',
        path: '/admin/users',
        key: 'admin_users',
        icon: 'Users',
        section: 'access-control',
        accent: 'blue',
        description: 'Manage user accounts and workspace access',
      },
      {
        id: 'teams',
        label: 'Teams',
        path: '/admin/teams',
        key: 'admin_teams',
        icon: 'Building2',
        section: 'access-control',
        accent: 'blue',
        description: 'Organize members into teams and departments',
      },
      {
        id: 'roles',
        label: 'Roles',
        path: '/admin/roles',
        key: 'admin_roles',
        icon: 'Shield',
        section: 'access-control',
        accent: 'blue',
        description: 'Define permissions and role assignments',
      },
      {
        id: 'media-list',
        label: 'Media List',
        path: '/admin/media-list',
        key: 'admin_data',
        icon: 'Newspaper',
        section: 'content',
        accent: 'teal',
        description: 'Curate media listings and published assets',
      },
      {
        id: 'tenant-sso',
        label: 'Tenant SSO',
        path: '/admin/tenant-sso',
        key: 'admin_users',
        icon: 'Building2',
        section: 'access-control',
        accent: 'blue',
        description: 'Link Clerk organizations for enterprise SAML/OIDC',
        riskLevel: 'caution',
        platformAdmin: true,
        setupRequiredKey: 'sso',
      },
      {
        id: 'developers',
        label: 'Developers',
        path: '/developers',
        key: 'admin_developers',
        icon: 'Brackets',
        section: 'operations',
        accent: 'orange',
        description: 'API keys, webhooks, and integration settings',
      },
      {
        id: 'lead-audits',
        label: 'Lead Audits',
        path: '/admin/lead-audits',
        key: 'admin_data',
        icon: 'History',
        section: 'content',
        accent: 'teal',
        description: 'Review lead change history and audit trails',
      },
      {
        id: 'crm-stats',
        label: 'CRM Stats',
        path: '/admin/crm-stats',
        key: 'admin_data',
        icon: 'BarChart2',
        section: 'analytics',
        accent: 'purple',
        description: 'Pipeline, rep activity, and month-to-date CRM business',
      },
      {
        id: 'artist-path',
        label: 'Artist Path',
        path: '/admin/artist-path',
        key: 'admin_artist_path',
        icon: 'Music',
        section: 'content',
        accent: 'teal',
        description: 'Configure artist onboarding journey steps',
      },
      {
        id: 'ops-hub',
        label: 'Ops Hub',
        path: '/admin/ops-hub',
        key: 'admin_ops_hub',
        icon: 'Layers',
        section: 'operations',
        accent: 'orange',
        description: 'Operational workflows and hub management tools',
      },
      {
        id: 'platform-settings',
        label: 'Platform Settings',
        path: '/admin/platform-settings',
        key: 'admin_users',
        icon: 'Settings2',
        section: 'operations',
        accent: 'orange',
        description: 'Global platform configuration and feature toggles',
        riskLevel: 'caution',
        platformAdmin: true,
      },
      {
        id: 'scripts',
        label: 'Script Runner',
        path: '/admin/scripts',
        key: 'admin_scripts',
        icon: 'Brackets',
        section: 'operations',
        accent: 'orange',
        description: 'Run one-off maintenance scripts',
        riskLevel: 'caution',
        platformAdmin: true,
      },
      {
        id: 'exly',
        label: 'Exly Data',
        path: '/admin/exly-campaigns',
        key: 'admin_exly',
        icon: 'BarChart2',
        section: 'analytics',
        accent: 'purple',
        description: 'View Exly campaign data and funnel metrics',
      },
      {
        id: 'project-analytics',
        label: 'Project Analytics',
        path: '/admin/project-analytics',
        key: 'admin_project_analytics',
        icon: 'BarChart3',
        section: 'analytics',
        accent: 'purple',
        description: 'Track project usage and engagement trends',
      },
      {
        id: 'gamification',
        label: 'Gamification',
        path: '/admin/gamification',
        key: 'admin_gamification',
        icon: 'Trophy',
        section: 'analytics',
        accent: 'purple',
        description: 'Configure points, badges, and engagement rules',
      },
      {
        id: 'qa',
        label: 'QA Testing',
        path: '/admin/qa',
        key: 'admin_data',
        icon: 'Activity',
        section: 'developer',
        accent: 'green',
        description: 'Run QA test suites and validation checks',
        platformAdmin: true,
      },
      {
        id: 'render-logs',
        label: 'Render Logs',
        key: 'admin_data',
        icon: 'ScrollText',
        section: 'developer',
        accent: 'green',
        description: 'Production API, staging API, and Nest log streams on Render',
        path: '/',
        platformAdmin: true,
      },
      {
        id: 'posthog',
        label: 'PostHog',
        key: 'admin_data',
        icon: 'BarChart3',
        section: 'developer',
        accent: 'purple',
        description: 'CoreKnot production analytics — insights, dashboards, replay',
        externalUrl: 'https://us.posthog.com/project/468825',
      },
    ],
  },
};

/** Admin Console hub — section order and labels for grouped tile layout. */
export const ADMIN_CONSOLE_SECTIONS = [
  { id: 'access-control', label: 'Access Control' },
  { id: 'content', label: 'Content Management' },
  { id: 'operations', label: 'Operations & Config' },
  { id: 'analytics', label: 'Analytics & Reporting' },
  { id: 'developer', label: 'Developer Tools' },
];

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
  '/documents',
  '/artists',
  '/admin/users',
  '/admin/teams',
  '/admin/roles',
  '/admin/media-list',
  '/admin/lead-audits',
  '/admin/crm-stats',
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
];

const HUB_PATHS = [
  { path: '/crm', label: 'CRM' },
  { path: '/office', label: 'Office' },
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
  '/attendance': 'primary',
  '/equipment': 'hubs',
  '/contacts': 'hubs',
  '/subscriptions': 'hubs',
  '/leads': 'hubs',
  '/followups': 'hubs',
  '/bookings': 'hubs',
  '/finance': 'hubs',
  '/announcements': 'hubs',
  '/artists': 'hubs',
  '/admin/users': 'hubs',
  '/admin/teams': 'hubs',
  '/admin/exly-campaigns': 'hubs',
  '/admin/scripts': 'hubs',
  '/admin/gamification': 'hubs',
  '/admin/project-analytics': 'hubs',
  '/admin/crm-stats': 'hubs',
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
  documents: '/documents',
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
  if (['/finance', '/announcements', '/documents', '/artists'].includes(path)) return '/management';
  if (path.startsWith('/admin')) return '/admin/console';
  return null;
}
