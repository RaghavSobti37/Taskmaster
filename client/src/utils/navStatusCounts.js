/**
 * Maps sidebar paths to urgent (rose) and today/review (amber) counts from status-counts API.
 * Todo counts use the same getTodoStats base filter as the Todo page (dueDate-first overdue).
 * Projects overdue uses dashboard-scoped project tasks (matches ProjectsView cards).
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
      const reviewPending = review.pending || 0;

      if (overdue > 0) {
        return {
          count: overdue,
          todayCount: 0,
          badgeCount: overdue,
          badgeVariant: 'rose',
        };
      }
      if (reviewPending > 0) {
        return {
          count: 0,
          todayCount: reviewPending,
          badgeCount: reviewPending,
          badgeVariant: 'amber',
        };
      }
      return {
        count: 0,
        todayCount: today,
        badgeCount: today,
        badgeVariant: 'amber',
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
