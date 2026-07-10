/** Central keyboard shortcut registry for settings tab + inline hints. */
export const SHORTCUT_REGISTRY = [
  { id: 'global.search', keys: ['Ctrl', 'K'], label: 'Quick search', routes: ['*'] },
  { id: 'todo.new', keys: ['N'], label: 'New task', routes: ['/todo', '/dashboard'] },
  { id: 'project.save', keys: ['Ctrl', 'S'], label: 'Save project', routes: ['/projects/:id'] },
  { id: 'inbox.focus', keys: ['G', 'I'], label: 'Go to inbox', routes: ['*'] },
  { id: 'calendar.today', keys: ['T'], label: 'Jump to today', routes: ['/calendar'] },
  { id: 'dailylog.open', keys: ['L'], label: 'Open daily log', routes: ['/daily-log', '/dashboard'] },
];

export function shortcutsForRoute(pathname) {
  return SHORTCUT_REGISTRY.filter((s) => s.routes.includes('*') || s.routes.some((r) => {
    if (!r.includes(':')) return pathname === r || pathname.startsWith(`${r}/`);
    const base = r.split('/:')[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  }));
}
