import { isToday, startOfDay, isBefore } from 'date-fns';

export const PRIORITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function getTaskDay(task) {
  const raw = task?.scheduleDate || task?.dueDate;
  if (!raw) return null;
  const day = startOfDay(new Date(raw));
  return Number.isNaN(day.getTime()) ? null : day;
}

export function isTaskOverdue(task, today = startOfDay(new Date())) {
  const day = getTaskDay(task);
  return Boolean(day && isBefore(day, today));
}

export function isTaskToday(task, today = startOfDay(new Date())) {
  const day = getTaskDay(task);
  return Boolean(day && isToday(day));
}

export function isDashboardFocusTask(task, today = startOfDay(new Date())) {
  if (task?.status === 'done' || task?.status === 'in-review') return false;
  const day = getTaskDay(task);
  if (!day) return false;
  return isToday(day) || isBefore(day, today);
}

export function filterTodayTasks(tasks = [], today = startOfDay(new Date())) {
  return tasks.filter(
    (t) =>
      t?.status !== 'done' &&
      t?.status !== 'in-review' &&
      isTaskToday(t, today)
  );
}

export function filterOverdueTasks(tasks = [], today = startOfDay(new Date())) {
  return tasks.filter(
    (t) =>
      t?.status !== 'done' &&
      t?.status !== 'in-review' &&
      isTaskOverdue(t, today)
  );
}

export function getPriorityRank(priority) {
  return PRIORITY_RANK[String(priority || 'medium').toLowerCase()] ?? 2;
}

/** direction: 'asc' | 'desc' — default desc = critical first */
export function sortTasksByPriority(tasks, direction = 'desc') {
  const mult = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const diff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (diff !== 0) return diff * mult;
    const aTime = getTaskDay(a)?.getTime() ?? 0;
    const bTime = getTaskDay(b)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

/** direction: 'asc' | 'desc' */
export function sortTasksByDate(tasks, direction = 'asc') {
  const mult = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const aTime = getTaskDay(a)?.getTime() ?? 0;
    const bTime = getTaskDay(b)?.getTime() ?? 0;
    if (aTime !== bTime) return (aTime - bTime) * mult;
    return getPriorityRank(b.priority) - getPriorityRank(a.priority);
  });
}

/** Overdue first (oldest first), then today. */
export function sortDashboardFocusTasks(a, b, today = startOfDay(new Date())) {
  const aOver = isTaskOverdue(a, today);
  const bOver = isTaskOverdue(b, today);
  if (aOver !== bOver) return aOver ? -1 : 1;
  const aTime = getTaskDay(a)?.getTime() ?? 0;
  const bTime = getTaskDay(b)?.getTime() ?? 0;
  return aTime - bTime;
}

export function filterDashboardFocusTasks(tasks = []) {
  const today = startOfDay(new Date());
  return tasks
    .filter((t) => isDashboardFocusTask(t, today))
    .sort((a, b) => sortDashboardFocusTasks(a, b, today));
}
