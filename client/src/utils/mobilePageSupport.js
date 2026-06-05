import { HUB_CONFIG } from './navbarConfig';

/** Mobile support tiers for route gating */
export const MOBILE_PAGE_LEVEL = {
  FULL: 'full',
  LIMITED: 'limited',
  DESKTOP: 'desktop',
};

const DEFAULT_ALTERNATIVES = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Tasks', path: '/todo' },
  { label: 'Inbox', path: '/inbox' },
];

const DESKTOP_ROUTE_RULES = [
  {
    match: (pathname) => /^\/admin(\/|$)/.test(pathname),
    title: 'Admin Tools',
    description:
      'Data Hub, script runner, QA scans, and system configuration need a large screen and keyboard. Open CoreKnot on your computer to use these tools.',
  },
  {
    match: (pathname) => /^\/emails(\/|$)/.test(pathname),
    title: 'Email Campaigns',
    description:
      'Campaign editor, template studio, and delivery analytics are built for desktop workflows. Review summaries and activity from a laptop or monitor.',
  },
  {
    match: (pathname) => pathname === '/workflows' || pathname.startsWith('/workflows/'),
    title: 'Workflow Canvas',
    description:
      'Visual workflow editing uses drag-and-drop on a wide canvas. Open this page on desktop for the full editor experience.',
  },
  {
    match: (pathname) => pathname === '/components',
    title: 'Component Showcase',
    description: 'Internal design-system gallery is intended for desktop QA and development review.',
  },
  {
    match: (pathname) => /^\/campaign\//.test(pathname),
    title: 'Campaign Analytics',
    description:
      'Campaign drill-down charts and geo breakdowns are optimized for desktop. Open the campaign on a larger screen for full detail.',
  },
  {
    match: (pathname) => /\/analytics$/.test(pathname),
    title: 'Project Analytics',
    description:
      'Analytics dashboards use multi-column charts and dense tables. View them on desktop for the complete picture.',
  },
  {
    match: (pathname) => pathname === '/office-assets' || pathname.startsWith('/office-assets/'),
    title: 'Office Assets',
    description: 'Asset inventory management works best with desktop layout and keyboard shortcuts.',
  },
  {
    match: (pathname) => pathname === '/features',
    title: 'Features',
    description: 'Marketing feature overview is formatted for wide screens.',
  },
  {
    match: (pathname) => pathname === '/projects/new',
    title: 'Create Project',
    description:
      'Project setup includes multi-step forms and member pickers that are easier on desktop. You can still browse projects on mobile.',
    alternatives: [
      { label: 'Projects', path: '/projects' },
      { label: 'Tasks', path: '/todo' },
    ],
  },
  {
    match: (pathname) => /^\/workspaces\//.test(pathname),
    title: 'Workspace Settings',
    description:
      'Workspace configuration and permissions are easier to manage on a desktop screen.',
    alternatives: [{ label: 'Projects', path: '/projects' }],
  },
];

/** Hub tabs that require desktop on mobile */
const HUB_DESKTOP_TABS = {
  '/management': ['finance', 'ops-logs'],
};

const HUB_TAB_COPY = {
  finance: {
    title: 'Finance',
    description:
      'Document folders, OCR review, and reimbursement workflows need desktop screen space. Open Finance on your computer.',
    alternatives: [{ label: 'Announcements', path: '/management?tab=announcements' }],
  },
  'ops-logs': {
    title: 'Ops Logs',
    description:
      'System log terminal and live diagnostics are built for wide monitors. Use desktop for full log streaming and filters.',
    alternatives: [{ label: 'Announcements', path: '/management?tab=announcements' }],
  },
};

const NAV_DESKTOP_ONLY_PATHS = new Set(['/emails', '/admin/console']);

function buildDesktopMeta(title, description, alternatives) {
  return {
    level: MOBILE_PAGE_LEVEL.DESKTOP,
    title,
    description,
    alternatives: alternatives || DEFAULT_ALTERNATIVES,
  };
}

/**
 * Resolve mobile support for current route.
 * @param {string} pathname
 * @param {string} [search] - location.search (with or without leading ?)
 */
export function getMobilePageSupport(pathname, search = '') {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalizedSearch);

  for (const [hubPath, desktopTabs] of Object.entries(HUB_DESKTOP_TABS)) {
    if (pathname !== hubPath && !pathname.startsWith(`${hubPath}/`)) continue;
    const tab = params.get('tab');
    if (!tab) continue;
    if (desktopTabs.includes(tab)) {
      const copy = HUB_TAB_COPY[tab];
      const hub = HUB_CONFIG[hubPath];
      const tabLabel = hub?.tabs?.find((t) => t.id === tab)?.label || copy?.title || tab;
      return buildDesktopMeta(
        copy?.title || tabLabel,
        copy?.description || `${tabLabel} is optimized for desktop.`,
        copy?.alternatives
      );
    }
  }

  for (const rule of DESKTOP_ROUTE_RULES) {
    if (rule.match(pathname)) {
      return buildDesktopMeta(rule.title, rule.description, rule.alternatives);
    }
  }

  if (/^\/artists\/[^/]+/.test(pathname)) {
    return {
      level: MOBILE_PAGE_LEVEL.LIMITED,
      title: 'Artist Profile',
      description: 'Artist analytics charts are easier to read on desktop. Core details remain available here.',
    };
  }

  if (/^\/projects\/[^/]+$/.test(pathname) && pathname !== '/projects/new') {
    return {
      level: MOBILE_PAGE_LEVEL.LIMITED,
      title: 'Project Detail',
      description: 'Kanban boards and task modals work on mobile with some layout constraints.',
    };
  }

  return { level: MOBILE_PAGE_LEVEL.FULL };
}

/** Whether mobile should hard-block this route (desktop-only gate). */
export function isDesktopRequiredOnMobile(pathname, search = '') {
  return getMobilePageSupport(pathname, search).level === MOBILE_PAGE_LEVEL.DESKTOP;
}

/** Sidebar hint: fully desktop-only nav entry on mobile */
export function isNavDesktopOnly(path) {
  return NAV_DESKTOP_ONLY_PATHS.has(path);
}

/** Mobile-friendly pages for bottom nav / quick links */
export const MOBILE_PRIMARY_PATHS = [
  '/dashboard',
  '/todo',
  '/projects',
  '/attendance',
  '/inbox',
  '/notes',
];
