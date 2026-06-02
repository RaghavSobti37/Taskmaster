/**
 * Dashboard Component Registry
 * Central source of truth for all dashboard widgets, their access rules, and layout templates.
 */

// Permission presets from Department model: 'admin', 'operations', 'sales', 'artist-management', 'standard'

export const COMPONENT_REGISTRY = {
  // ── Universal (all departments) ──
  'leaderboard': { label: 'Leaderboard', access: ['all'], defaultSize: '1', icon: '🏆' },
  'daily-missions': { label: 'Daily Missions', access: ['all'], defaultSize: '1', icon: '🎯' },
  'announcements': { label: 'Announcements', access: ['all'], defaultSize: '1', icon: '📢' },
  'pinboard': { label: 'Pin Board', access: ['all'], defaultSize: '1', icon: '📌' },
  'schedule': { label: "Today's Calendar", access: ['all'], defaultSize: '1', icon: '📅' },
  'review-queue': { label: 'Review Queue', access: ['all'], defaultSize: '2', icon: '✅' },
  'todos-today': { label: 'Today Tasks', access: ['all'], defaultSize: '2', icon: '📋' },
  'todos-overdue': { label: 'Overdue Tasks', access: ['all'], defaultSize: '2', icon: '⚠️' },
  'projects-today': { label: 'Projects Today', access: ['all'], defaultSize: '4', icon: '📊' },
  'notes': { label: 'Notes', access: ['all'], defaultSize: '2', icon: '📝' },
  'composer': { label: 'Composer', access: ['all'], defaultSize: '2', icon: '✏️' },
  'mark-attendance': { label: 'Clock In/Out', access: ['all'], defaultSize: '1', icon: '⏰' },

  // ── Operations / Admin ──
  'leave-alerts': { label: 'Leave Alerts', access: ['operations', 'admin'], defaultSize: '1', icon: '🏖️' },
  'invoice-alerts': { label: 'Invoice Alerts', access: ['operations', 'admin'], defaultSize: '1', icon: '💰' },
  'attendance-overview': { label: 'Attendance Overview', access: ['operations', 'admin'], defaultSize: '2', icon: '👥' },
  'team-activity': { label: 'Team Activity', access: ['admin', 'operations'], defaultSize: '2', icon: '📡' },

  // ── Sales ──
  'booked-calls': { label: 'Booked Calls', access: ['sales'], defaultSize: '2', icon: '📞' },
  'followups-today': { label: 'Follow Ups Today', access: ['sales'], defaultSize: '2', icon: '🔔' },
  'pipeline-summary': { label: 'CRM Stats', access: ['sales', 'admin'], defaultSize: '2', icon: '🔀' },
  'campaign-metrics': { label: 'Campaign Metrics', access: ['sales', 'admin'], defaultSize: '2', icon: '📈' },

  // ── Admin Only ──
  'dept-stats': { label: 'Department Stats', access: ['admin'], defaultSize: '2', icon: '🏢' },
  'system-health': { label: 'System Health', access: ['admin'], defaultSize: '1', icon: '🖥️' },

  // ── Artist Management ──
  'artist-calendar': { label: 'Booking Calendar', access: ['artist-management'], defaultSize: '2', icon: '🎨' },
};

/**
 * Filter components accessible to a given department permission preset.
 * @param {string} permissionPreset - e.g. 'admin', 'sales', 'operations', 'standard'
 * @returns {string[]} - array of componentIds the user can access
 */
export const getAccessibleComponents = (permissionPreset) => {
  const preset = permissionPreset || 'standard';
  return Object.entries(COMPONENT_REGISTRY)
    .filter(([, meta]) => meta.access.includes('all') || meta.access.includes(preset))
    .map(([id]) => id);
};

/**
 * Check if a single component is accessible to a department.
 */
export const canAccessComponent = (componentId, permissionPreset) => {
  const meta = COMPONENT_REGISTRY[componentId];
  if (!meta) return false;
  return meta.access.includes('all') || meta.access.includes(permissionPreset || 'standard');
};

// ── Layout Templates ──
// Each template has a name, description, target departments, and element layout.

export const LAYOUT_TEMPLATES = [
  {
    id: 'coreknot',
    name: 'Coreknot',
    description: 'Balanced default with tasks, projects, and team tools',
    target: ['all'],
    elements: [
      { componentId: 'leaderboard', size: '1', col: 1, row: 1 },
      { componentId: 'daily-missions', size: '1', col: 1, row: 2 },
      { componentId: 'announcements', size: '1', col: 1, row: 3 },
      { componentId: 'pinboard', size: '1', col: 1, row: 4 },
      { componentId: 'schedule', size: '1', col: 1, row: 5 },
      { componentId: 'review-queue', size: '2', col: 2, row: 1 },
      { componentId: 'todos-today', size: '2', col: 2, row: 2 },
      { componentId: 'projects-today', size: '2', col: 2, row: 3 },
      { componentId: 'notes', size: '1', col: 4, row: 1 },
      { componentId: 'composer', size: '1', col: 4, row: 2 },
    ],
  },
  {
    id: 'schedule-viewer',
    name: 'Schedule Viewer',
    description: 'Calendar-first layout for time-oriented workflows',
    target: ['all'],
    elements: [
      { componentId: 'schedule', size: '4', col: 1, row: 1 },
      { componentId: 'todos-today', size: '2', col: 1, row: 2 },
      { componentId: 'projects-today', size: '2', col: 3, row: 2 },
      { componentId: 'todos-overdue', size: '2', col: 1, row: 3 },
      { componentId: 'announcements', size: '2', col: 3, row: 3 },
    ],
  },
  {
    id: 'notes-first',
    name: 'Notes First',
    description: 'Writing-focused with notes and composer front and center',
    target: ['all'],
    elements: [
      { componentId: 'notes', size: '3', col: 1, row: 1 },
      { componentId: 'composer', size: '1', col: 4, row: 1 },
      { componentId: 'todos-today', size: '2', col: 1, row: 2 },
      { componentId: 'schedule', size: '2', col: 3, row: 2 },
      { componentId: 'pinboard', size: '2', col: 1, row: 3 },
      { componentId: 'announcements', size: '2', col: 3, row: 3 },
    ],
  },
  {
    id: 'sales-command',
    name: 'Sales Command',
    description: 'Pipeline, calls, and follow-ups at a glance',
    target: ['sales'],
    elements: [
      { componentId: 'pipeline-summary', size: '2', col: 1, row: 1 },
      { componentId: 'booked-calls', size: '2', col: 3, row: 1 },
      { componentId: 'followups-today', size: '2', col: 1, row: 2 },
      { componentId: 'campaign-metrics', size: '2', col: 3, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 1, row: 3 },
      { componentId: 'todos-today', size: '2', col: 2, row: 3 },
      { componentId: 'mark-attendance', size: '1', col: 4, row: 3 },
    ],
  },
  {
    id: 'operations-hub',
    name: 'Operations Hub',
    description: 'Attendance, leaves, invoices, and team oversight',
    target: ['operations'],
    elements: [
      { componentId: 'attendance-overview', size: '2', col: 1, row: 1 },
      { componentId: 'leave-alerts', size: '1', col: 3, row: 1 },
      { componentId: 'invoice-alerts', size: '1', col: 4, row: 1 },
      { componentId: 'team-activity', size: '2', col: 1, row: 2 },
      { componentId: 'todos-today', size: '2', col: 3, row: 2 },
      { componentId: 'mark-attendance', size: '1', col: 1, row: 3 },
      { componentId: 'announcements', size: '1', col: 2, row: 3 },
      { componentId: 'schedule', size: '2', col: 3, row: 3 },
    ],
  },
  {
    id: 'admin-control',
    name: 'Admin Control',
    description: 'Full organizational oversight and analytics',
    target: ['admin'],
    elements: [
      { componentId: 'dept-stats', size: '2', col: 1, row: 1 },
      { componentId: 'system-health', size: '1', col: 3, row: 1 },
      { componentId: 'mark-attendance', size: '1', col: 4, row: 1 },
      { componentId: 'team-activity', size: '4', col: 1, row: 2 },
      { componentId: 'attendance-overview', size: '2', col: 1, row: 3 },
      { componentId: 'leave-alerts', size: '1', col: 3, row: 3 },
      { componentId: 'invoice-alerts', size: '1', col: 4, row: 3 },
      { componentId: 'leaderboard', size: '1', col: 1, row: 4 },
      { componentId: 'todos-today', size: '2', col: 2, row: 4 },
      { componentId: 'pipeline-summary', size: '1', col: 4, row: 4 },
    ],
  },
  {
    id: 'artist-manager',
    name: 'Artist Manager',
    description: 'Bookings, calendar, and creative team coordination',
    target: ['artist-management'],
    elements: [
      { componentId: 'artist-calendar', size: '2', col: 1, row: 1 },
      { componentId: 'schedule', size: '2', col: 3, row: 1 },
      { componentId: 'todos-today', size: '2', col: 1, row: 2 },
      { componentId: 'announcements', size: '1', col: 3, row: 2 },
      { componentId: 'notes', size: '1', col: 4, row: 2 },
      { componentId: 'pinboard', size: '2', col: 1, row: 3 },
      { componentId: 'mark-attendance', size: '1', col: 3, row: 3 },
    ],
  },
  {
    id: 'minimal-focus',
    name: 'Minimal Focus',
    description: 'Distraction-free: just tasks, notes, and schedule',
    target: ['all'],
    elements: [
      { componentId: 'todos-today', size: '4', col: 1, row: 1 },
      { componentId: 'notes', size: '2', col: 1, row: 2 },
      { componentId: 'schedule', size: '2', col: 3, row: 2 },
    ],
  },
  {
    id: 'team-lead',
    name: 'Team Lead',
    description: 'Review queue, projects, and team performance',
    target: ['all'],
    elements: [
      { componentId: 'review-queue', size: '2', col: 1, row: 1 },
      { componentId: 'projects-today', size: '2', col: 3, row: 1 },
      { componentId: 'leaderboard', size: '1', col: 1, row: 2 },
      { componentId: 'announcements', size: '1', col: 2, row: 2 },
      { componentId: 'todos-today', size: '2', col: 3, row: 2 },
      { componentId: 'todos-overdue', size: '2', col: 1, row: 3 },
      { componentId: 'pinboard', size: '2', col: 3, row: 3 },
    ],
  },
  {
    id: 'communication-hub',
    name: 'Communication Hub',
    description: 'Pinboard, composer, and announcements for team comms',
    target: ['all'],
    elements: [
      { componentId: 'pinboard', size: '2', col: 1, row: 1 },
      { componentId: 'composer', size: '2', col: 3, row: 1 },
      { componentId: 'announcements', size: '2', col: 1, row: 2 },
      { componentId: 'notes', size: '2', col: 3, row: 2 },
      { componentId: 'todos-today', size: '2', col: 1, row: 3 },
      { componentId: 'schedule', size: '2', col: 3, row: 3 },
    ],
  },
  {
    id: 'morning-routine',
    name: 'Morning Routine',
    description: 'Start your day: attendance, schedule, and tasks',
    target: ['all'],
    elements: [
      { componentId: 'mark-attendance', size: '1', col: 1, row: 1 },
      { componentId: 'schedule', size: '1', col: 2, row: 1 },
      { componentId: 'todos-today', size: '2', col: 3, row: 1 },
      { componentId: 'announcements', size: '2', col: 1, row: 2 },
      { componentId: 'notes', size: '2', col: 3, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 1, row: 3 },
      { componentId: 'pinboard', size: '1', col: 2, row: 3 },
      { componentId: 'todos-overdue', size: '2', col: 3, row: 3 },
    ],
  },
  {
    id: 'analytics-dashboard',
    name: 'Analytics Dashboard',
    description: 'Data-driven overview for leadership',
    target: ['admin'],
    elements: [
      { componentId: 'dept-stats', size: '2', col: 1, row: 1 },
      { componentId: 'pipeline-summary', size: '2', col: 3, row: 1 },
      { componentId: 'campaign-metrics', size: '2', col: 1, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 3, row: 2 },
      { componentId: 'system-health', size: '1', col: 4, row: 2 },
      { componentId: 'team-activity', size: '4', col: 1, row: 3 },
    ],
  },
];

/**
 * Get templates accessible to a given department permission preset.
 */
export const getAccessibleTemplates = (permissionPreset) => {
  const preset = permissionPreset || 'standard';
  return LAYOUT_TEMPLATES.filter(t =>
    t.target.includes('all') || t.target.includes(preset)
  );
};
