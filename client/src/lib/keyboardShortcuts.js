/**
 * Global keyboard shortcut registry — single source of truth for palette, G-chords, and help overlay.
 */

export const G_CHORD_TIMEOUT_MS = 1500;

/** Always-available G-chord destinations (department presets are additive in the palette UI only). */
export const GLOBAL_G_CHORD_ROUTES = {
  d: { path: '/dashboard', label: 'Dashboard', chord: 'G D' },
  t: { path: '/todo', label: 'Todo', chord: 'G T' },
  p: { path: '/projects', label: 'Projects', chord: 'G P' },
  i: { path: '/inbox', label: 'Inbox', chord: 'G I' },
  a: { path: '/attendance', label: 'Attendance', chord: 'G A' },
  s: { path: '/settings', label: 'Settings', chord: 'G S' },
  c: { path: '/calendar', label: 'Calendar', chord: 'G C' },
  l: { path: '/crm', label: 'CRM', chord: 'G L' },
  f: { path: '/crm?tab=followups', label: 'Follow-ups', chord: 'G F' },
  m: { path: '/management', label: 'Management', chord: 'G M' },
  h: { path: '/admin', label: 'Data Hub', chord: 'G H' },
  n: { path: '/notes', label: 'Notes', chord: 'G N' },
  e: { path: '/emails', label: 'Emails', chord: 'G E' },
  r: { path: '/schedule', label: 'Schedule', chord: 'G R' },
  o: { path: '/office', label: 'Office', chord: 'G O' },
  u: { path: '/admin/users', label: 'Users', chord: 'G U', adminOnly: true },
  b: { path: '/admin/console', label: 'Admin Console', chord: 'G B', adminOnly: true },
};

export const SHORTCUT_SECTIONS = [
  {
    title: 'Global',
    items: [
      { id: 'palette', label: 'Command palette', display: '⌘K / Ctrl+K' },
      { id: 'help', label: 'Keyboard shortcuts', display: '?' },
      { id: 'slash', label: 'Quick search (opens palette)', display: '/' },
    ],
  },
  {
    title: 'Navigation',
    subtitle: 'Press G, then the letter within 1.5s',
    items: Object.entries(GLOBAL_G_CHORD_ROUTES).map(([key, route]) => ({
      id: `g-${key}`,
      label: route.label,
      display: route.chord,
      adminOnly: route.adminOnly,
    })),
  },
  {
    title: 'Command palette (when open)',
    items: [
      { id: 'up-down', label: 'Move selection', display: '↑ ↓' },
      { id: 'enter', label: 'Run selected action', display: 'Enter' },
      { id: 'esc', label: 'Close', display: 'Esc' },
    ],
  },
];

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('[data-shortcuts-ignore]')) return true;
  return false;
}

export function isModKey(e) {
  return e.metaKey || e.ctrlKey;
}

/**
 * @param {string} key — single lowercase letter after G
 * @param {{ isAdmin?: boolean }} opts
 */
export function resolveGChord(key, { isAdmin = false } = {}) {
  const route = GLOBAL_G_CHORD_ROUTES[String(key || '').toLowerCase()];
  if (!route) return null;
  if (route.adminOnly && !isAdmin) return null;
  return route;
}

export function filterShortcutSections(sections, { isAdmin = false } = {}) {
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  }));
}
