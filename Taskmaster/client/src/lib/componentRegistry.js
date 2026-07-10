/**
 * Dashboard Component Registry
 * Central source of truth for all dashboard widgets, their access rules, and layout templates.
 */

import { getDefaultTierElements } from './dashboardSections';

// Permission presets from Department model: 'admin', 'operations', 'sales', 'artist-management', 'standard'

/** Settings route for dashboard layout editor */
export const DASHBOARD_SETTINGS_PATH = '/settings?tab=dashboard';

export const COMPONENT_REGISTRY = {
  // ── Universal (all departments) ──
  'leaderboard': { label: 'Leaderboard', access: ['all'], defaultSize: '1', icon: '🏆', mobileTier: 'social', mobileOrder: 14 },
  'daily-missions': { label: 'Daily Missions', access: ['all'], defaultSize: '1', icon: '🎯', mobileTier: 'social', mobileOrder: 13 },
  'announcements': { label: 'Announcements', access: ['all'], defaultSize: '1', icon: '📢', mobileTier: 'social', mobileOrder: 11 },
  'pinboard': { label: 'Pin Board', access: ['all'], defaultSize: '1', icon: '📌', mobileTier: 'social', mobileOrder: 12 },
  'schedule': { label: "Today's Calendar", access: ['all'], defaultSize: '1', icon: '📅', mobileTier: 'action', mobileOrder: 5 },
  'review-queue': { label: 'Review Queue', access: ['all'], defaultSize: '2', icon: '✅', mobileTier: 'action', mobileOrder: 4 },
  'todos-today': { label: 'Today Tasks', access: ['all'], defaultSize: '2', icon: '📋', mobileTier: 'action', mobileOrder: 2 },
  'todos-overdue': { label: 'Overdue Tasks', access: ['all'], defaultSize: '2', icon: '⚠️', mobileTier: 'action', mobileOrder: 3 },
  'projects-today': { label: 'Projects Today', access: ['all'], defaultSize: '4', icon: '📊', mobileTier: 'social', mobileOrder: 17 },
  'notes': { label: 'Notes', access: ['all'], defaultSize: '2', icon: '📝', mobileTier: 'social', mobileOrder: 15 },
  'composer': { label: 'Composer', access: ['all'], defaultSize: '2', icon: '✏️', mobileTier: 'social', mobileOrder: 16 },
  'mark-attendance': { label: 'Clock In/Out', access: ['all'], defaultSize: '1', icon: '⏰', mobileTier: 'action', mobileOrder: 1 },

  // ── Operations / Admin ──
  'leave-alerts': { label: 'Leave Requests', access: ['operations', 'admin'], defaultSize: '1', icon: '🏖️', mobileTier: 'analytics', mobileOrder: 25 },
  'invoice-alerts': { label: 'Reimbursements', access: ['operations', 'admin'], defaultSize: '1', icon: '💰', mobileTier: 'analytics', mobileOrder: 26 },
  'attendance-overview': { label: 'Attendance Overview', access: ['operations', 'admin'], defaultSize: '2', icon: '👥', mobileTier: 'analytics', mobileOrder: 23 },
  'team-activity': { label: 'Task Activity', access: ['admin', 'operations'], defaultSize: '2', icon: '📡', mobileTier: 'analytics', mobileOrder: 24 },

  // ── Sales ──
  'booked-calls': { label: 'Booked Calls', access: ['sales'], defaultSize: '2', icon: '📞', mobileTier: 'action', mobileOrder: 6 },
  'followups-today': { label: 'Follow Ups Today', access: ['sales'], defaultSize: '2', icon: '🔔', mobileTier: 'action', mobileOrder: 7 },
  'pipeline-summary': { label: 'CRM Stats', access: ['sales', 'admin'], defaultSize: '2', icon: '🔀', mobileTier: 'analytics', mobileOrder: 21 },
  'campaign-metrics': { label: 'Campaign Metrics', access: ['sales', 'admin'], defaultSize: '2', icon: '📈', mobileTier: 'analytics', mobileOrder: 22 },

  // ── Admin Only ──
  'dept-stats': { label: 'Department Stats', access: ['admin'], defaultSize: '2', icon: '🏢', mobileTier: 'analytics', mobileOrder: 27 },
  'system-health': { label: 'System Health', access: ['admin'], defaultSize: '1', icon: '🖥️', mobileTier: 'analytics', mobileOrder: 28 },
  'last-backup': { label: 'Last Backup', access: ['admin'], defaultSize: '1', icon: '💾', mobileTier: 'analytics', mobileOrder: 29 },
  'render-logs': {
    label: 'Render Logs',
    description: 'Open Render Dashboard log streams for production and staging services',
    access: ['admin'],
    defaultSize: '1',
    icon: '📜',
    mobileTier: 'analytics',
    mobileOrder: 30,
  },
  posthog: {
    label: 'PostHog',
    description: 'Open CoreKnot production analytics — insights, dashboards, session replay',
    access: ['admin'],
    defaultSize: '1',
    icon: '📊',
    mobileTier: 'analytics',
    mobileOrder: 34,
  },
  clerk: {
    label: 'Clerk',
    description: 'Open Clerk Dashboard — users, sessions, JWT templates, webhooks',
    access: ['admin'],
    defaultSize: '1',
    icon: '🔐',
    mobileTier: 'analytics',
    mobileOrder: 35,
  },
  // ── Artist Management ──
  'artist-calendar': { label: 'Booking Calendar', access: ['artist-management'], defaultSize: '2', icon: '🎨', mobileTier: 'action', mobileOrder: 8 },
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

/** Mobile widget sort: action first, then social, analytics last */
export const getMobileWidgetOrder = (componentId) => {
  const meta = COMPONENT_REGISTRY[componentId];
  const tierRank = { action: 0, social: 1, analytics: 2 };
  const tier = meta?.mobileTier || 'social';
  const order = meta?.mobileOrder ?? 50;
  return (tierRank[tier] ?? 1) * 100 + order;
};

export const isAnalyticsWidget = (componentId) =>
  COMPONENT_REGISTRY[componentId]?.mobileTier === 'analytics';

// ── Layout Templates ──
// Each template has a name, description, target departments, and element layout.

export const LAYOUT_TEMPLATES = [
  {
    id: 'coreknot',
    name: 'CoreKnot',
    description: 'Daily actions first — clock, calendar, tasks, review; team context below; clutter hidden',
    target: ['all'],
    elements: [
      { componentId: 'mark-attendance', size: '1', col: 1, row: 1 },
      { componentId: 'schedule', size: '1', col: 2, row: 1 },
      { componentId: 'todos-today', size: '1', col: 3, row: 1 },
      { componentId: 'todos-overdue', size: '1', col: 4, row: 1 },
      { componentId: 'review-queue', size: '2', col: 1, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 3, row: 2 },
      { componentId: 'announcements', size: '1', col: 4, row: 2 },
      { componentId: 'projects-today', size: '4', col: 1, row: 3 },
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
    description: 'Daily sales actions first; pipeline metrics on lower rows',
    target: ['sales'],
    elements: [
      { componentId: 'mark-attendance', size: '1', col: 1, row: 1 },
      { componentId: 'schedule', size: '1', col: 2, row: 1 },
      { componentId: 'todos-today', size: '1', col: 3, row: 1 },
      { componentId: 'todos-overdue', size: '1', col: 4, row: 1 },
      { componentId: 'review-queue', size: '2', col: 1, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 3, row: 2 },
      { componentId: 'announcements', size: '1', col: 4, row: 2 },
      { componentId: 'projects-today', size: '4', col: 1, row: 3 },
      { componentId: 'pipeline-summary', size: '2', col: 1, row: 4 },
      { componentId: 'campaign-metrics', size: '2', col: 3, row: 4 },
    ],
  },
  {
    id: 'operations-hub',
    name: 'Operations Hub',
    description: 'Attendance and team oversight; leave/reimbursement alerts available in Library',
    target: ['operations'],
    elements: [
      { componentId: 'mark-attendance', size: '1', col: 1, row: 1 },
      { componentId: 'schedule', size: '1', col: 2, row: 1 },
      { componentId: 'todos-today', size: '1', col: 3, row: 1 },
      { componentId: 'todos-overdue', size: '1', col: 4, row: 1 },
      { componentId: 'attendance-overview', size: '2', col: 1, row: 2 },
      { componentId: 'team-activity', size: '2', col: 3, row: 2 },
      { componentId: 'review-queue', size: '2', col: 1, row: 3 },
      { componentId: 'announcements', size: '1', col: 3, row: 3 },
      { componentId: 'leaderboard', size: '1', col: 4, row: 3 },
      { componentId: 'projects-today', size: '4', col: 1, row: 4 },
    ],
  },
  {
    id: 'admin-control',
    name: 'Admin Control',
    description: 'Daily actions up top; compact health strip; analytics on lower rows',
    target: ['admin'],
    elements: [
      { componentId: 'mark-attendance', size: '1', col: 1, row: 1 },
      { componentId: 'schedule', size: '1', col: 2, row: 1 },
      { componentId: 'todos-today', size: '1', col: 3, row: 1 },
      { componentId: 'todos-overdue', size: '1', col: 4, row: 1 },
      { componentId: 'review-queue', size: '2', col: 1, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 3, row: 2 },
      { componentId: 'announcements', size: '1', col: 4, row: 2 },
      { componentId: 'projects-today', size: '4', col: 1, row: 3 },
      { componentId: 'system-health', size: '1', col: 1, row: 4 },
      { componentId: 'last-backup', size: '1', col: 2, row: 4 },
      { componentId: 'render-logs', size: '1', col: 3, row: 4 },
      { componentId: 'posthog', size: '1', col: 4, row: 4 },
      { componentId: 'pipeline-summary', size: '2', col: 3, row: 4 },
      { componentId: 'dept-stats', size: '2', col: 1, row: 5 },
      { componentId: 'campaign-metrics', size: '2', col: 3, row: 5 },
      { componentId: 'team-activity', size: '2', col: 1, row: 6 },
      { componentId: 'attendance-overview', size: '2', col: 1, row: 7 },
    ],
  },
  {
    id: 'artist-manager',
    name: 'Artist Manager',
    description: 'Bookings, calendar, and creative team coordination',
    target: ['artist-management'],
    elements: [
      { componentId: 'schedule', size: '2', col: 1, row: 1 },
      { componentId: 'todos-today', size: '2', col: 3, row: 1 },
      { componentId: 'pinboard', size: '2', col: 1, row: 2 },
      { componentId: 'announcements', size: '1', col: 3, row: 2 },
      { componentId: 'notes', size: '1', col: 4, row: 2 },
      { componentId: 'review-queue', size: '2', col: 1, row: 3 },
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
    description: 'Data-driven overview — MetricPanelGroup KPI headers + chart widgets',
    target: ['admin'],
    elements: [
      { componentId: 'dept-stats', size: '2', col: 1, row: 1 },
      { componentId: 'pipeline-summary', size: '2', col: 3, row: 1 },
      { componentId: 'campaign-metrics', size: '2', col: 1, row: 2 },
      { componentId: 'leaderboard', size: '1', col: 3, row: 2 },
      { componentId: 'system-health', size: '1', col: 3, row: 2 },
      { componentId: 'last-backup', size: '1', col: 4, row: 2 },
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

/** Recommended layout template id for a department permission preset. */
export const getRecommendedTemplateId = (permissionPreset) => {
  const map = {
    sales: 'sales-command',
    operations: 'operations-hub',
    admin: 'admin-control',
    'artist-management': 'artist-manager',
    'artist-business': 'artist-manager',
  };
  return map[permissionPreset] || 'coreknot';
};

/** Default grid elements for a permission preset (new users / reset). */
export const getDefaultLayoutElements = (permissionPreset) =>
  getDefaultTierElements(permissionPreset);
