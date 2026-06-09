/** Department zero-state nav presets for Command Palette */

/** Universal create actions — wired to QuickAdd modals via quickActionId */
export const QUICK_ACTIONS = [
  {
    id: 'quick-task',
    label: 'Add Task',
    sublabel: 'New todo or assignment',
    icon: 'ListTodo',
    type: 'action',
    quickActionId: 'task',
    iconTone: 'emerald',
  },
  {
    id: 'quick-log',
    label: 'Add Daily Log',
    sublabel: 'Log hours and work activity',
    icon: 'NotebookPen',
    type: 'action',
    quickActionId: 'log',
    iconTone: 'amber',
  },
  {
    id: 'quick-note',
    label: 'Add Note',
    sublabel: 'Private scratchpad entry',
    icon: 'StickyNote',
    type: 'action',
    quickActionId: 'note',
    iconTone: 'blue',
  },
  {
    id: 'quick-event',
    label: 'Add Event',
    sublabel: 'Calendar entry or meeting',
    icon: 'CalendarDays',
    type: 'action',
    quickActionId: 'event',
    iconTone: 'violet',
  },
  {
    id: 'quick-asset',
    label: 'Add Asset Link',
    sublabel: 'Drive, sheet, or any URL',
    icon: 'Link2',
    type: 'action',
    quickActionId: 'asset',
    iconTone: 'cyan',
  },
  {
    id: 'quick-pin',
    label: 'Add Team Pin',
    sublabel: 'Share on the team pinboard',
    icon: 'Pin',
    type: 'action',
    quickActionId: 'pin',
    iconTone: 'rose',
  },
];

const FALLBACK_ACTIONS = [
  { id: 'dash', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', type: 'nav', shortcut: 'G D' },
  { id: 'proj', label: 'Projects', icon: 'Briefcase', path: '/projects', type: 'nav', shortcut: 'G P' },
  { id: 'todo', label: 'Todo', icon: 'ListTodo', path: '/todo', type: 'nav', shortcut: 'G T' },
  { id: 'inbox', label: 'Inbox', icon: 'Inbox', path: '/inbox', type: 'nav', shortcut: 'G I' },
  { id: 'notes', label: 'Notes', icon: 'FileText', path: '/notes', type: 'nav', shortcut: 'G N' },
  { id: 'attendance', label: 'Attendance', icon: 'ClipboardCheck', path: '/attendance', type: 'nav', shortcut: 'G A' },
  { id: 'set', label: 'Settings', icon: 'Settings', path: '/settings', type: 'nav', shortcut: 'G S' },
];

const DEPARTMENT_PRESETS = {
  sales: [
    { id: 'todo', label: 'Todo', icon: 'ListTodo', path: '/todo', type: 'nav', shortcut: 'G T' },
    { id: 'logs', label: 'Daily Logs', icon: 'NotebookPen', path: '/logs', type: 'nav' },
    { id: 'crm', label: 'CRM Hub', icon: 'UserPlus', path: '/crm', type: 'nav', shortcut: 'G L' },
    { id: 'followups', label: 'Follow-ups', icon: 'PhoneCall', path: '/crm?tab=followups', type: 'nav', shortcut: 'G F' },
    { id: 'cal', label: 'Calendar', icon: 'CalendarDays', path: '/calendar', type: 'nav', shortcut: 'G C' },
    { id: 'inbox', label: 'Inbox', icon: 'Inbox', path: '/inbox', type: 'nav', shortcut: 'G I' },
  ],
  operations: [
    { id: 'todo', label: 'Todo', icon: 'ListTodo', path: '/todo', type: 'nav', shortcut: 'G T' },
    { id: 'logs', label: 'Daily Logs', icon: 'NotebookPen', path: '/logs', type: 'nav' },
    { id: 'management', label: 'Management Hub', icon: 'CircleDollarSign', path: '/management', type: 'nav', shortcut: 'G M' },
    { id: 'ops-logs', label: 'Ops Logs', icon: 'Activity', path: '/management?tab=ops-logs', type: 'nav' },
    { id: 'attendance', label: 'Attendance', icon: 'ClipboardCheck', path: '/attendance', type: 'nav', shortcut: 'G A' },
    { id: 'dash', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', type: 'nav', shortcut: 'G D' },
  ],
  'artist-management': [
    { id: 'todo', label: 'Todo', icon: 'ListTodo', path: '/todo', type: 'nav', shortcut: 'G T' },
    { id: 'crm', label: 'CRM Hub', icon: 'UserPlus', path: '/crm', type: 'nav', shortcut: 'G L' },
    { id: 'artists', label: 'Artists', icon: 'CircleDollarSign', path: '/management?tab=artists', type: 'nav' },
    { id: 'management', label: 'Management Hub', icon: 'CircleDollarSign', path: '/management?tab=artists', type: 'nav', shortcut: 'G M' },
    { id: 'bookings', label: 'Bookings', icon: 'CalendarDays', path: '/crm?tab=bookings', type: 'nav' },
    { id: 'inbox', label: 'Inbox', icon: 'Inbox', path: '/inbox', type: 'nav', shortcut: 'G I' },
  ],
  admin: [
    { id: 'todo', label: 'Todo', icon: 'ListTodo', path: '/todo', type: 'nav', shortcut: 'G T' },
    { id: 'logs', label: 'Daily Logs', icon: 'NotebookPen', path: '/logs', type: 'nav' },
    { id: 'data-hub', label: 'Data Hub', icon: 'Database', path: '/admin', type: 'nav', shortcut: 'G H' },
    { id: 'admin-console', label: 'Admin Console', icon: 'Database', path: '/admin/console', type: 'nav', shortcut: 'G B' },
    { id: 'users', label: 'Users', icon: 'Users', path: '/admin/users', type: 'nav', shortcut: 'G U' },
    { id: 'inbox', label: 'Inbox', icon: 'Inbox', path: '/inbox', type: 'nav', shortcut: 'G I' },
    { id: 'dash', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', type: 'nav', shortcut: 'G D' },
  ],
};

/**
 * @deprecated Use GLOBAL_G_CHORD_ROUTES from lib/keyboardShortcuts.js — kept for legacy imports.
 */
const G_CHORD_MAP = {
  d: 'dash',
  t: 'todo',
  p: 'proj',
  l: 'crm',
  c: 'cal',
  i: 'inbox',
  s: 'set',
  f: 'followups',
  a: 'attendance',
  m: 'management',
  h: 'data-hub',
  n: 'notes',
  e: 'emails',
  r: 'schedule',
  o: 'office',
  u: 'users',
  b: 'admin-console',
};

export function getDepartmentPaletteActions(departmentSlug) {
  const slug = String(departmentSlug || '').toLowerCase();
  return DEPARTMENT_PRESETS[slug] || FALLBACK_ACTIONS;
}

function findPaletteActionById(actions, id) {
  return actions.find((a) => a.id === id);
}

export { FALLBACK_ACTIONS, DEPARTMENT_PRESETS };
