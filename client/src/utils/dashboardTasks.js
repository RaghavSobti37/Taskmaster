import { isToday, startOfDay, isBefore } from 'date-fns';

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

export function isDashboardFocusTask(task, today = startOfDay(new Date())) {
  if (task?.status === 'done' || task?.status === 'in-review') return false;
  const day = getTaskDay(task);
  if (!day) return false;
  return isToday(day) || isBefore(day, today);
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
