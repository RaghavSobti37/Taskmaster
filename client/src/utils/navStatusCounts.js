/**
 * Maps sidebar paths to urgent (rose) and today (amber) indicator counts from status-counts API.
 */
export function getNavCountsForPath(path, statusCounts = {}) {
  const tasks = statusCounts.tasks || {};
  const followups = statusCounts.followups || {};
  const calendar = statusCounts.calendar || {};
  const notifications = statusCounts.notifications || {};
  const review = statusCounts.review || {};

  switch (path) {
    case '/inbox':
      return { count: notifications.unread || 0, todayCount: 0 };
    case '/todo': {
      const overdue = tasks.overdue || 0;
      const today = tasks.today || 0;
      const inReview = tasks.inReview || 0;
      if (inReview > 0) {
        return {
          count: overdue,
          todayCount: inReview,
          badgeCount: inReview,
          badgeVariant: 'amber',
        };
      }
      const todayOnly = overdue > 0 ? 0 : today;
      return {
        count: overdue,
        todayCount: todayOnly,
        badgeCount: overdue + todayOnly,
        badgeVariant: overdue > 0 ? 'rose' : 'amber',
      };
    }
    case '/followups': {
      const overdue = followups.overdue || 0;
      const today = followups.today || 0;
      return { count: overdue, todayCount: overdue > 0 ? 0 : today };
    }
    case '/leads':
      return {
        count: followups.overdue || 0,
        todayCount: (followups.overdue || 0) > 0 ? 0 : (followups.today || 0),
      };
    case '/calendar':
      return { count: 0, todayCount: calendar.today || 0 };
    case '/projects': {
      const projects = statusCounts.projects || {};
      const reviewPending = projects.review || 0;
      const overdue = projects.overdue || 0;
      const badgeCount = overdue > 0 ? overdue : reviewPending;
      return {
        count: overdue,
        todayCount: overdue > 0 ? 0 : reviewPending,
        badgeCount,
        badgeVariant: overdue > 0 ? 'rose' : 'amber',
      };
    }
    default:
      return { count: 0, todayCount: 0 };
  }
}

/** Total attention items for a nav group (sum of child paths). */
function sumNavCountsForPaths(paths, statusCounts) {
  let urgent = 0;
  let today = 0;
  for (const path of paths) {
    const { count, todayCount } = getNavCountsForPath(path, statusCounts);
    urgent += count;
    today += todayCount;
  }
  return { count: urgent, todayCount: urgent > 0 ? 0 : today };
}

export function totalNavBadge(count, todayCount) {
  return (count || 0) + (todayCount || 0);
}
