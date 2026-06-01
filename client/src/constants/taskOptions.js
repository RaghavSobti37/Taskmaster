export const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'in-review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...STATUS_OPTIONS,
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/** Calendar days between start date and due date, keyed by priority. */
export const PRIORITY_DAY_SPAN = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export function getPriorityDaySpan(priority) {
  return PRIORITY_DAY_SPAN[String(priority || 'medium').toLowerCase()] ?? PRIORITY_DAY_SPAN.medium;
}

export const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  ...PRIORITY_OPTIONS,
];

/** Badge variant for task priority — medium = apricot bg + rose text. */
export function getPriorityBadgeVariant(priority) {
  const p = String(priority || 'medium').toLowerCase();
  if (p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'medium') return 'medium';
  if (p === 'low') return 'low';
  return 'medium';
}

export const PROJECT_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'User' },
];

export const PROJECT_ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  member: 'User',
  owner: 'Admin',
};

export const TASK_CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'content', label: 'Content' },
  { value: 'design', label: 'Design' },
  { value: 'ops', label: 'Operations' },
  { value: 'review', label: 'Review' },
  { value: 'general', label: 'General' },
];

/** Map legacy / mined task type names → general category. */
const LEGACY_TYPE_MAP = {
  edit: 'content',
  'final cut': 'content',
  'final edit': 'content',
  grading: 'content',
  dubbing: 'content',
  color: 'content',
  mix: 'content',
  export: 'content',
  film: 'content',
  audio: 'content',
  compression: 'ops',
  rushes: 'ops',
  planning: 'ops',
  support: 'ops',
  review: 'review',
  bug: 'bug',
  fix: 'bug',
  feature: 'feature',
  design: 'design',
  general: 'general',
};

export function normalizeTaskCategory(type) {
  if (!type) return 'general';
  const key = String(type).trim().toLowerCase();
  if (TASK_CATEGORY_OPTIONS.some((c) => c.value === key)) return key;
  if (LEGACY_TYPE_MAP[key]) return LEGACY_TYPE_MAP[key];
  for (const [legacy, category] of Object.entries(LEGACY_TYPE_MAP)) {
    if (key.includes(legacy)) return category;
  }
  return 'general';
}

export function taskCategoryLabel(value) {
  const normalized = normalizeTaskCategory(value);
  return TASK_CATEGORY_OPTIONS.find((c) => c.value === normalized)?.label || 'General';
}

export const SLOT_OPTIONS = [
  { value: 'FULL', label: 'Full Day' },
  { value: 'AM', label: 'Morning (AM)' },
  { value: 'PM', label: 'Afternoon (PM)' },
];

export function projectRoleLabel(role) {
  return PROJECT_ROLE_LABELS[role] || role || 'User';
}

/** Map stored role to picker value (admin / manager / member). */
export function normalizeProjectRoleValue(role) {
  if (role === 'owner') return 'admin';
  if (role === 'artist_management') return 'manager';
  if (PROJECT_ROLE_OPTIONS.some((o) => o.value === role)) return role;
  return 'member';
}
