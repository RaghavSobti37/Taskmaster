import { lazy } from 'react';

/** Registry id → dynamic import for dashboard widgets (code-split per widget). */
export const DASHBOARD_WIDGET_LOADERS = {
  leaderboard: () => import('../components/dashboard/LeaderboardPodium'),
  'daily-missions': () => import('../components/dashboard/DailyMissionsCard'),
  announcements: () => import('../components/dashboard/AnnouncementsCard'),
  pinboard: () => import('../components/dashboard/PinBoardMessages'),
  schedule: () => import('../components/dashboard/CalendarTodayCard'),
  'review-queue': () => import('../components/dashboard/ReviewQueueCard'),
  'todos-today': () => import('../components/dashboard/TodosTodayCard'),
  'todos-overdue': () => import('../components/dashboard/TodosOverdueCard'),
  'projects-today': () => import('../components/dashboard/ProjectsTodayCard'),
  notes: () => import('../components/dashboard/NotesPanel'),
  composer: () => import('../components/dashboard/PinBoardComposer'),
  'mark-attendance': () => import('../components/dashboard/MarkAttendanceCard'),
  'pipeline-summary': () => import('../components/dashboard/PipelineSummaryCard'),
  'leave-alerts': () => import('../components/dashboard/LeaveRequestsCard'),
  'invoice-alerts': () => import('../components/dashboard/ReimbursementsCard'),
  'booked-calls': () => import('../components/dashboard/GenericDashboardCard'),
  'followups-today': () => import('../components/dashboard/GenericDashboardCard'),
  'team-activity': () => import('../components/dashboard/GenericDashboardCard'),
  'dept-stats': () => import('../components/dashboard/GenericDashboardCard'),
  'campaign-metrics': () => import('../components/dashboard/GenericDashboardCard'),
  'system-health': () => import('../components/dashboard/GenericDashboardCard'),
  'artist-calendar': () => import('../components/dashboard/GenericDashboardCard'),
  'attendance-overview': () => import('../components/dashboard/AttendanceOverviewCard'),
  'last-backup': () => import('../components/dashboard/LastBackupCard'),
};

const lazyWidgetCache = new Map();

export function getLazyDashboardWidget(componentId) {
  const loader = DASHBOARD_WIDGET_LOADERS[componentId];
  if (!loader) return null;
  if (!lazyWidgetCache.has(componentId)) {
    lazyWidgetCache.set(componentId, lazy(loader));
  }
  return lazyWidgetCache.get(componentId);
}
