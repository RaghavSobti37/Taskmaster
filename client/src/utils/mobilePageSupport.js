import { HUB_CONFIG } from './navbarConfig';

/** Mobile support tiers for route gating */
export const MOBILE_PAGE_LEVEL = {
  FULL: 'full',
  LIMITED: 'limited',
  /** @deprecated Never returned — kept for imports; use LIMITED + banner instead */
  DESKTOP: 'desktop',
};

const DEFAULT_ALTERNATIVES = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Tasks', path: '/todo' },
  { label: 'Inbox', path: '/inbox' },
];

/** Routes that work on mobile but benefit from a soft desktop banner */
const LIMITED_ROUTE_RULES = [
  {
    match: (pathname) => /^\/admin\//.test(pathname) && pathname !== '/admin/console',
    title: 'Admin Tools',
    description:
      'Admin tables and config are usable on mobile; complex edits are easier on a large screen.',
  },
  {
    match: (pathname) => /^\/emails(\/|$)/.test(pathname),
    title: 'Email Campaigns',
    description:
      'Campaign editor and analytics work on mobile; template studio is easier on desktop.',
    autoBanner: false,
  },
  {
    match: (pathname) => pathname === '/workflows' || pathname.startsWith('/workflows/'),
    title: 'Workflow Canvas',
    description:
      'Workflow canvas scrolls on mobile; drag-and-drop editing is easier on a wide screen.',
  },
  {
    match: (pathname) => pathname === '/components',
    title: 'Component Showcase',
    description: 'Design-system gallery is readable on mobile; QA review is easier on desktop.',
  },
  {
    match: (pathname) => /^\/campaign\//.test(pathname),
    title: 'Campaign Analytics',
    description: 'Charts stack on mobile; open on desktop for multi-column analytics.',
  },
  {
    match: (pathname) => /\/analytics$/.test(pathname),
    title: 'Project Analytics',
    description: 'Analytics dashboards stack on mobile; desktop shows full chart grid.',
    autoBanner: false,
  },
  {
    match: (pathname) => pathname === '/office-assets' || pathname.startsWith('/office-assets/'),
    title: 'Office Assets',
    description: 'Asset inventory is browsable on mobile; bulk edits are easier on desktop.',
  },
  {
    match: (pathname) => pathname === '/features',
    title: 'Features',
    description: 'Marketing overview reflows on mobile; wide layout on desktop.',
  },
  {
    match: (pathname) => pathname === '/projects/new',
    title: 'Create Project',
    description: 'Project setup forms stack on mobile; member pickers are easier on desktop.',
    alternatives: [
      { label: 'Projects', path: '/projects' },
      { label: 'Tasks', path: '/todo' },
    ],
  },
  {
    match: (pathname) => /^\/workspaces\//.test(pathname),
    title: 'Workspace Settings',
    description: 'Workspace settings are editable on mobile; permissions UI is easier on desktop.',
    alternatives: [{ label: 'Projects', path: '/projects' }],
  },
  {
    match: (pathname) => pathname === '/schedule',
    title: 'Schedule',
    description: 'Day-grouped task list on mobile; department grid on desktop.',
    autoBanner: false,
  },
];

/** Hub tabs with limited mobile UX (still accessible) */
const HUB_LIMITED_TABS = {
  '/management': ['finance'],
};

const HUB_TAB_COPY = {
  finance: {
    title: 'Finance',
    description:
      'Browse folders on mobile; OCR review and split-pane preview work best on desktop.',
    autoBanner: false,
  },
};

function buildLimitedMeta(title, description, alternatives, autoBanner = true) {
  return {
    level: MOBILE_PAGE_LEVEL.LIMITED,
    title,
    description,
    alternatives: alternatives || DEFAULT_ALTERNATIVES,
    autoBanner,
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

  for (const [hubPath, limitedTabs] of Object.entries(HUB_LIMITED_TABS)) {
    if (pathname !== hubPath && !pathname.startsWith(`${hubPath}/`)) continue;
    const tab = params.get('tab');
    if (!tab) continue;
    if (limitedTabs.includes(tab)) {
      const copy = HUB_TAB_COPY[tab];
      const hub = HUB_CONFIG[hubPath];
      const tabLabel = hub?.tabs?.find((t) => t.id === tab)?.label || copy?.title || tab;
      return buildLimitedMeta(
        copy?.title || tabLabel,
        copy?.description || `${tabLabel} is easier to manage on desktop but available here.`,
        copy?.alternatives,
        copy?.autoBanner !== false
      );
    }
  }

  for (const rule of LIMITED_ROUTE_RULES) {
    if (rule.match(pathname)) {
      return buildLimitedMeta(
        rule.title,
        rule.description,
        rule.alternatives,
        rule.autoBanner !== false
      );
    }
  }

  if (/^\/artists\/[^/]+/.test(pathname)) {
    return buildLimitedMeta(
      'Artist Profile',
      'Artist analytics charts stack on mobile; core profile data remains available.'
    );
  }

  if (/^\/projects\/[^/]+$/.test(pathname) && pathname !== '/projects/new') {
    return buildLimitedMeta(
      'Project Detail',
      'Kanban and task modals work on mobile; dense boards are easier on desktop.'
    );
  }

  return { level: MOBILE_PAGE_LEVEL.FULL, autoBanner: false };
}

/** Whether route should show auto-injected mobile banner */
export function shouldShowMobileBanner(pathname, search = '') {
  const support = getMobilePageSupport(pathname, search);
  return (
    support.level === MOBILE_PAGE_LEVEL.LIMITED &&
    Boolean(support.description) &&
    support.autoBanner !== false
  );
}

/** Sidebar: all nav entries reachable on mobile */
export function isNavDesktopOnly(_path) {
  return false;
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
