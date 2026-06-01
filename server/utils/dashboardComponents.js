const { isAdminUser } = require('./departmentPermissions');

const COMPONENT_ACCESS = {
  leaderboard: ['all'],
  announcements: ['all'],
  pinboard: ['all'],
  schedule: ['all'],
  'review-queue': ['all'],
  'todos-today': ['all'],
  'todos-overdue': ['all'],
  'projects-today': ['all'],
  notes: ['all'],
  composer: ['all'],
  'mark-attendance': ['all'],
  'leave-alerts': ['operations', 'admin'],
  'invoice-alerts': ['operations', 'admin'],
  'attendance-overview': ['operations', 'admin'],
  'team-activity': ['admin', 'operations'],
  'booked-calls': ['sales'],
  'followups-today': ['sales'],
  'pipeline-summary': ['sales', 'admin'],
  'campaign-metrics': ['sales', 'admin'],
  'dept-stats': ['admin'],
  'system-health': ['admin'],
  'artist-calendar': ['artist-management'],
};

function getPermissionPreset(user) {
  if (isAdminUser(user)) return 'admin';
  const dept = user?.departmentId;
  if (!dept || typeof dept !== 'object') return 'standard';
  return dept.permissionPreset || dept.slug || 'standard';
}

function canAccessComponent(componentId, user) {
  const access = COMPONENT_ACCESS[componentId];
  if (!access) return false;
  const preset = getPermissionPreset(user);
  return access.includes('all') || access.includes(preset);
}

function filterDashboardElements(elements, user) {
  if (!Array.isArray(elements)) return [];
  return elements.filter((el) => canAccessComponent(el.componentId, user));
}

module.exports = {
  canAccessComponent,
  filterDashboardElements,
  getPermissionPreset,
};
