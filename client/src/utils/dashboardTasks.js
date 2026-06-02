import { isToday, startOfDay, isBefore } from 'date-fns';

export const PRIORITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** @param {'schedule'|'due'} prefer — which date field wins when both exist */
export function getTaskDay(task, prefer = 'schedule') {
  const raw =
    prefer === 'due'
      ? task?.dueDate || task?.scheduleDate
      : task?.scheduleDate || task?.dueDate;
  if (!raw) return null;
  const day = startOfDay(new Date(raw));
  return Number.isNaN(day.getTime()) ? null : day;
}

const NO_TASK_DAY = Infinity;

function compareTaskDayTime(a, b, prefer, direction) {
  const aTime = getTaskDay(a, prefer)?.getTime() ?? NO_TASK_DAY;
  const bTime = getTaskDay(b, prefer)?.getTime() ?? NO_TASK_DAY;
  if (aTime !== bTime) return direction === 'asc' ? aTime - bTime : bTime - aTime;
  return getPriorityRank(b.priority) - getPriorityRank(a.priority);
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

export function filterTasksByTimeframe(tasks = [], timeframe = '7d', today = startOfDay(new Date())) {
  const days = timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : 30;
  return tasks.filter((t) => {
    if (t?.status === 'done' || t?.status === 'in-review') return false;
    const day = getTaskDay(t);
    if (!day) return false;
    // Difference in days (0 for today, 1 for tomorrow, etc.)
    const diff = (day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    // Include tasks that are overdue or due within the timeframe
    return diff < days;
  });
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

/** direction: 'asc' | 'desc' — tasks without a date sort last */
export function sortTasksByDate(tasks, direction = 'asc', prefer = 'schedule') {
  return [...tasks].sort((a, b) => compareTaskDayTime(a, b, prefer, direction));
}

/** Todo page: due date sort (no due date always last). */
export function sortTasksByDueDate(tasks, direction = 'asc') {
  return sortTasksByDate(tasks, direction, 'due');
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
