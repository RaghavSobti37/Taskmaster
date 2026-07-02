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
  { value: 'sales', label: 'Sales' },
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
  sales: 'sales',
  general: 'general',
};

export function slugTaskCategoryLabel(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function slugifyTaskCategoryInput(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function normalizeTaskCategory(type) {
  if (!type) return 'general';
  const key = String(type).trim().toLowerCase();
  if (TASK_CATEGORY_OPTIONS.some((c) => c.value === key)) return key;
  if (LEGACY_TYPE_MAP[key]) return LEGACY_TYPE_MAP[key];
  for (const [legacy, category] of Object.entries(LEGACY_TYPE_MAP)) {
    if (key.includes(legacy)) return category;
  }
  // ponytail: preserve user-added slug categories
  const slug = slugifyTaskCategoryInput(key);
  if (slug && /^[a-z][a-z0-9-]*$/.test(slug)) return slug;
  return 'general';
}

export function taskCategoryLabel(value) {
  const normalized = normalizeTaskCategory(value);
  return TASK_CATEGORY_OPTIONS.find((c) => c.value === normalized)?.label || slugTaskCategoryLabel(normalized) || 'General';
}

/** Merge built-in categories with workspace TaskType rows from the API. */
export function mergeTaskCategoryOptions(remoteTypes = []) {
  const seen = new Set(TASK_CATEGORY_OPTIONS.map((o) => o.value));
  const merged = [...TASK_CATEGORY_OPTIONS];
  for (const row of remoteTypes) {
    const raw = row?.name || row?.value;
    if (!raw) continue;
    const value = normalizeTaskCategory(raw);
    if (!value || seen.has(value)) continue;
    merged.push({ value, label: slugTaskCategoryLabel(value) });
    seen.add(value);
  }
  return merged;
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

const normalizeProjectUserId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

/** Project role for a user (admin | manager | member). Mirrors shared/projectRoles.js. */
export function getProjectRoleForUser(project, userId) {
  if (!project || !userId) return null;
  const uid = normalizeProjectUserId(userId);
  const ownerId = normalizeProjectUserId(project.owner);
  if (ownerId && ownerId === uid) return 'admin';

  const entry = (project.memberRoles || []).find((r) => {
    const roleUserId = normalizeProjectUserId(r.user?._id || r.user);
    return roleUserId === uid;
  });
  return normalizeProjectRoleValue(entry?.role);
}
