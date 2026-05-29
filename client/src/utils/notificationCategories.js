export const ALL_CATEGORIES = ['all', 'task', 'review', 'crm', 'attendance', 'announcement', 'department', 'system'];

const DEPT_CATEGORY_MAP = {
  sales: ['all', 'crm'],
  operations: ['all', 'task', 'review', 'attendance', 'department', 'announcement', 'system'],
  admin: ['all', 'task', 'review', 'attendance', 'department', 'announcement', 'system'],
  editor: ['all', 'task', 'review', 'system'],
  videographer: ['all', 'task', 'review', 'system'],
  'cg-artist': ['all', 'task', 'review', 'system'],
  'artist-management': ['all', 'task', 'review', 'system'],
};

export function getAllowedCategories({ departmentSlug, isAdmin = false } = {}) {
  if (isAdmin) return ALL_CATEGORIES;
  const slug = String(departmentSlug || '').toLowerCase();
  return DEPT_CATEGORY_MAP[slug] || ['all', 'task', 'system'];
}

export function filterNotificationsByCategories(notifications, allowedCategories) {
  if (!allowedCategories || allowedCategories.includes('all') && allowedCategories.length === ALL_CATEGORIES.length) {
    return notifications;
  }
  const cats = allowedCategories.filter((c) => c !== 'all');
  return notifications.filter((n) => cats.includes(n.category));
}
