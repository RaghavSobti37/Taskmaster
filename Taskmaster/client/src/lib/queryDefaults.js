/**
 * Central stale-time tiers for React Query.
 * Hooks may override per-query; defaults apply via queryClient defaultOptions.
 */
export const QUERY_STALE_TIMES = {
  /** Notifications, status badge counts */
  live: 15_000,
  /** Attendance, gamification leaderboard */
  realtime: 30_000,
  /** Calendar, data hub refresh windows */
  frequent: 60_000,
  /** Default GET stale-while-revalidate window */
  default: 5 * 60_000,
  /** Tasks, mail campaigns, dashboard summaries */
  moderate: 2 * 60_000,
  /** Projects, artists, departments, admin roles */
  stable: 10 * 60_000,
  /** Newsletter categories, USD/INR rate */
  slow: 30 * 60_000,
  /** Static config that never changes in-session */
  immutable: Infinity,
};

export const QUERY_GC_TIMES = {
  default: 10 * 60_000,
};

/** Per query-key-root overrides (first segment of queryKey). */
export const QUERY_STALE_BY_ROOT = {
  notifications: QUERY_STALE_TIMES.immutable,
  statusCounts: QUERY_STALE_TIMES.live,
  attendance: QUERY_STALE_TIMES.realtime,
  inbox: QUERY_STALE_TIMES.realtime,
  tasks: QUERY_STALE_TIMES.moderate,
  mail: QUERY_STALE_TIMES.moderate,
  projects: QUERY_STALE_TIMES.stable,
  dashboard: QUERY_STALE_TIMES.moderate,
  dataHub: QUERY_STALE_TIMES.frequent,
  gamification: QUERY_STALE_TIMES.realtime,
  calendar: QUERY_STALE_TIMES.frequent,
  leads: QUERY_STALE_TIMES.moderate,
  crm: QUERY_STALE_TIMES.moderate,
  notes: QUERY_STALE_TIMES.realtime,
  artists: QUERY_STALE_TIMES.stable,
  assets: QUERY_STALE_TIMES.stable,
  'artist-os': QUERY_STALE_TIMES.frequent,
  adminRoles: QUERY_STALE_TIMES.stable,
  departments: QUERY_STALE_TIMES.stable,
  'system-health': QUERY_STALE_TIMES.live,
  logs: QUERY_STALE_TIMES.slow,
  newsletter: QUERY_STALE_TIMES.slow,
};

export function resolveQueryStaleTime(queryKey) {
  const root = Array.isArray(queryKey) ? queryKey[0] : null;
  if (root && QUERY_STALE_BY_ROOT[root] != null) {
    return QUERY_STALE_BY_ROOT[root];
  }
  return QUERY_STALE_TIMES.default;
}
