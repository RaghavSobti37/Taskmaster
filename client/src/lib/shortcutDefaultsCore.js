/**
 * Keyboard shortcut defaults — client ESM source of truth for Vite.
 * SYNC: keep in sync with shared/shortcutDefaults.cjs (Node server).
 * keys: mod = Ctrl on Windows/Linux, Cmd on macOS
 */

export const NAV_ROUTES = [
  { suffix: 'dashboard', label: 'Dashboard', path: '/dashboard', keys: ['g', 'd'] },
  { suffix: 'todo', label: 'Todo', path: '/todo', keys: ['g', 't'] },
  { suffix: 'projects', label: 'Projects', path: '/projects', keys: ['g', 'p'] },
  { suffix: 'inbox', label: 'Inbox', path: '/inbox', keys: ['g', 'i'] },
  { suffix: 'attendance', label: 'Attendance', path: '/attendance', keys: ['g', 'a'] },
  { suffix: 'settings', label: 'Settings', path: '/settings', keys: ['g', 's'] },
  { suffix: 'calendar', label: 'Calendar', path: '/calendar', keys: ['g', 'c'] },
  { suffix: 'crm', label: 'CRM', path: '/crm', keys: ['g', 'l'] },
  { suffix: 'followups', label: 'Follow-ups', path: '/crm?tab=followups', keys: ['g', 'f'] },
  { suffix: 'management', label: 'Management', path: '/management', keys: ['g', 'm'] },
  { suffix: 'data-hub', label: 'Data Hub', path: '/admin', keys: ['g', 'h'] },
  { suffix: 'notes', label: 'Notes', path: '/notes', keys: ['g', 'n'] },
  { suffix: 'emails', label: 'Emails', path: '/emails', keys: ['g', 'e'] },
  { suffix: 'schedule', label: 'Schedule', path: '/schedule', keys: ['g', 'r'] },
  { suffix: 'office', label: 'Office', path: '/office', keys: ['g', 'o'] },
  { suffix: 'users', label: 'Users', path: '/admin/users', keys: ['g', 'u'], adminOnly: true },
  { suffix: 'admin-console', label: 'Admin Console', path: '/admin/console', keys: ['g', 'b'] },
];

export const GLOBAL_ACTIONS = [
  { id: 'palette', label: 'Command palette', category: 'global', defaultKeys: ['mod', 'k'] },
  { id: 'help', label: 'Keyboard shortcuts', category: 'global', defaultKeys: ['shift', '?'] },
  { id: 'search', label: 'Quick search (opens palette)', category: 'global', defaultKeys: ['/'] },
];

/** Single-key quick actions (disabled while typing in inputs) */
export const QUICK_ACTIONS = [
  { id: 'action-task', label: 'Add task', category: 'quick', quickActionId: 'task', defaultKeys: ['t'] },
  { id: 'action-log', label: 'Add daily log', category: 'quick', quickActionId: 'log', defaultKeys: ['d'] },
  { id: 'action-note', label: 'Add note', category: 'quick', quickActionId: 'note', defaultKeys: ['n'] },
  { id: 'action-event', label: 'Add event', category: 'quick', quickActionId: 'event', defaultKeys: ['e'] },
  { id: 'action-asset', label: 'Add asset link', category: 'quick', quickActionId: 'asset', defaultKeys: ['a'] },
  { id: 'action-pin', label: 'Add team pin', category: 'quick', quickActionId: 'pin', defaultKeys: ['p'] },
];

export const NAV_ACTIONS = NAV_ROUTES.map((route) => ({
  id: `nav-${route.suffix}`,
  label: `Go to ${route.label}`,
  category: 'nav',
  path: route.path,
  defaultKeys: route.keys,
  adminOnly: route.adminOnly || false,
}));

export const SHORTCUT_ACTIONS = [...GLOBAL_ACTIONS, ...QUICK_ACTIONS, ...NAV_ACTIONS];

/** scope: browser | macOS | Windows | Linux — platforms: all | mac | win | linux */
export const SYSTEM_SHORTCUT_CONFLICTS = [
  { keys: ['mod', 't'], label: 'New tab', scope: 'browser' },
  { keys: ['mod', 'w'], label: 'Close tab', scope: 'browser' },
  { keys: ['mod', 'n'], label: 'New window', scope: 'browser' },
  { keys: ['mod', 'r'], label: 'Reload page', scope: 'browser' },
  { keys: ['mod', 'shift', 'r'], label: 'Hard reload', scope: 'browser' },
  { keys: ['mod', 'p'], label: 'Print', scope: 'browser' },
  { keys: ['mod', 's'], label: 'Save page', scope: 'browser' },
  { keys: ['mod', 'f'], label: 'Find in page', scope: 'browser' },
  { keys: ['mod', 'g'], label: 'Find next', scope: 'browser' },
  { keys: ['mod', 'h'], label: 'History', scope: 'browser' },
  { keys: ['mod', 'j'], label: 'Downloads', scope: 'browser' },
  { keys: ['mod', 'd'], label: 'Bookmark page', scope: 'browser' },
  { keys: ['mod', 'l'], label: 'Focus address bar', scope: 'browser' },
  { keys: ['mod', 'shift', 't'], label: 'Reopen closed tab', scope: 'browser' },
  { keys: ['mod', 'shift', 'n'], label: 'New private window', scope: 'browser' },
  { keys: ['mod', 'shift', 'i'], label: 'Developer tools', scope: 'browser' },
  { keys: ['mod', 'shift', 'j'], label: 'Browser console', scope: 'browser' },
  { keys: ['mod', 'shift', 'c'], label: 'DevTools inspector', scope: 'browser' },
  { keys: ['mod', 'shift', 'delete'], label: 'Clear browsing data', scope: 'browser' },
  { keys: ['mod', 'a'], label: 'Select all', scope: 'browser' },
  { keys: ['mod', 'c'], label: 'Copy', scope: 'browser' },
  { keys: ['mod', 'v'], label: 'Paste', scope: 'browser' },
  { keys: ['mod', 'x'], label: 'Cut', scope: 'browser' },
  { keys: ['mod', 'z'], label: 'Undo', scope: 'browser' },
  { keys: ['mod', 'shift', 'z'], label: 'Redo', scope: 'browser' },
  { keys: ['mod', 'y'], label: 'Redo', scope: 'browser', platforms: ['win'] },
  { keys: ['f5'], label: 'Reload page', scope: 'browser' },
  { keys: ['f11'], label: 'Fullscreen', scope: 'browser' },
  { keys: ['alt', 'd'], label: 'Focus address bar', scope: 'browser' },
  { keys: ['alt', 'left'], label: 'Back', scope: 'browser' },
  { keys: ['alt', 'right'], label: 'Forward', scope: 'browser' },
  { keys: ['mod', 'q'], label: 'Quit browser', scope: 'macOS', platforms: ['mac'] },
  { keys: ['mod', 'h'], label: 'Hide application', scope: 'macOS', platforms: ['mac'] },
  { keys: ['mod', 'm'], label: 'Minimize window', scope: 'macOS', platforms: ['mac'] },
  { keys: ['mod', 'space'], label: 'Spotlight / launcher', scope: 'macOS', platforms: ['mac'] },
  { keys: ['mod', 'tab'], label: 'Switch tabs', scope: 'macOS', platforms: ['mac'] },
  { keys: ['alt', 'f4'], label: 'Close window', scope: 'Windows', platforms: ['win'] },
  { keys: ['alt', 'tab'], label: 'Switch apps', scope: 'Windows', platforms: ['win'] },
  { keys: ['ctrl', 'alt', 'delete'], label: 'Security screen', scope: 'Windows', platforms: ['win'] },
];

export const SHORTCUT_CATEGORY_LABELS = {
  global: 'Global',
  quick: 'Quick actions',
  nav: 'Navigation',
};

export function normalizeKeyTokens(keys) {
  return (keys || []).map((k) => String(k).toLowerCase());
}

export function keysEqual(a, b) {
  const na = normalizeKeyTokens(a);
  const nb = normalizeKeyTokens(b);
  if (na.length !== nb.length) return false;
  return na.every((k, i) => k === nb[i]);
}

export function getDefaultBindingsMap() {
  const map = {};
  for (const action of SHORTCUT_ACTIONS) {
    map[action.id] = { keys: [...action.defaultKeys] };
  }
  return map;
}

export function mergeShortcutBindings(overrides = {}) {
  const merged = getDefaultBindingsMap();
  for (const [id, binding] of Object.entries(overrides || {})) {
    if (!merged[id] && !SHORTCUT_ACTIONS.some((a) => a.id === id)) continue;
    if (binding === null) {
      merged[id] = null;
    } else if (binding?.keys?.length) {
      merged[id] = { keys: normalizeKeyTokens(binding.keys) };
    }
  }
  return merged;
}

export function getActionById(id) {
  return SHORTCUT_ACTIONS.find((a) => a.id === id);
}

export function filterActionsForUser(actions, { isAdmin = false } = {}) {
  return actions.filter((a) => !a.adminOnly || isAdmin);
}

export function buildLegacyGChordRoutes(bindingsMap, { isAdmin = false } = {}) {
  const routes = {};
  for (const action of filterActionsForUser(NAV_ACTIONS, { isAdmin })) {
    const binding = bindingsMap[action.id];
    if (!binding?.keys || binding.keys.length < 2) continue;
    const secondKey = binding.keys[binding.keys.length - 1];
    if (binding.keys[0] === 'g' && secondKey.length === 1) {
      routes[secondKey] = {
        path: action.path,
        label: action.label.replace(/^Go to /, ''),
        chord: `G ${secondKey.toUpperCase()}`,
        adminOnly: action.adminOnly,
      };
    }
  }
  return routes;
}
