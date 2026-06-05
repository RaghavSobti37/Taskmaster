const LEGACY_NAV_GROUP_IDS = new Set(['platform', 'workspace', 'office', 'crm', 'management', 'admin']);

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
  '/admin',
  '/admin/exly-campaigns',
  '/admin/scripts',
  '/admin/gamification',
  '/admin/project-analytics',
  '/admin/qa',
]);

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

const HUB_PATHS = [
  { path: '/crm', label: 'CRM' },
  { path: '/office', label: 'People & Office' },
  { path: '/management', label: 'Management' },
  { path: '/admin/console', label: 'Admin' },
];

const isLegacyNavbarGroups = (groups) => (groups || []).some((g) => LEGACY_NAV_GROUP_IDS.has(g.id));

const getHubPathForChildPath = (path) => {
  if (['/leads', '/followups', '/bookings'].includes(path)) return '/crm';
  if (['/equipment', '/contacts', '/subscriptions'].includes(path)) return '/office';
  if (['/finance', '/announcements', '/ops-logs', '/artists'].includes(path)) return '/management';
  if (path.startsWith('/admin')) return '/admin/console';
  return null;
};

/** Migrate saved 6-group navbar prefs to 3-zone structure. */
const migrateLegacyNavbarGroups = (userGroups, defaultGroups) => {
  const zonePages = {
    primary: [],
    tools: [],
    hubs: [],
  };
  const zoneSeen = {
    primary: new Set(),
    tools: new Set(),
    hubs: new Set(),
  };
  const hubChildVisible = new Set();

  for (const group of userGroups || []) {
    for (const page of group.pages || []) {
      const path = page.path;
      if (!path || path === '/chat') continue;

      if (HUB_CHILD_PATHS.has(path)) {
        if (page.visible !== false) hubChildVisible.add(getHubPathForChildPath(path));
        continue;
      }

      const zone = LEGACY_PATH_ZONE[path];
      if (!zone || zoneSeen[zone].has(path)) continue;
      zoneSeen[zone].add(path);
      zonePages[zone].push({
        ...page,
        path,
        order: zonePages[zone].length + 1,
      });
    }
  }

  for (const hub of HUB_PATHS) {
    if (hubChildVisible.has(hub.path) && !zoneSeen.hubs.has(hub.path)) {
      zoneSeen.hubs.add(hub.path);
      zonePages.hubs.push({
        path: hub.path,
        label: hub.label,
        order: zonePages.hubs.length + 1,
        visible: true,
      });
    }
  }

  return (defaultGroups || []).map((defaultGroup) => {
    const saved = zonePages[defaultGroup.id] || [];
    const defaultPages = defaultGroup.pages || [];
    const mergedPaths = new Set(saved.map((p) => p.path));
    const extras = defaultPages.filter((p) => !mergedPaths.has(p.path));
    const pages = [...saved, ...extras].map((page, idx) => ({
      ...page,
      order: idx + 1,
    }));
    return {
      ...defaultGroup,
      pages,
    };
  });
};

module.exports = {
  LEGACY_NAV_GROUP_IDS,
  HUB_CHILD_PATHS,
  isLegacyNavbarGroups,
  migrateLegacyNavbarGroups,
};
