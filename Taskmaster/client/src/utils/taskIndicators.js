import { startOfDay, isBefore, isSameDay } from 'date-fns';

/** Task list KPIs for Todo page overview and project tabs. */
export function computeTaskIndicators(tasks = []) {
  const now = startOfDay(new Date());
  let overdue = 0;
  let today = 0;
  let inReview = 0;
  let open = 0;

  for (const t of tasks) {
    if (t.status === 'done') continue;
    open += 1;
    if (t.status === 'in-review') inReview += 1;
    const raw = t.dueDate || t.scheduleDate;
    if (!raw) continue;
    const d = startOfDay(new Date(raw));
    if (Number.isNaN(d.getTime())) continue;
    if (isBefore(d, now)) overdue += 1;
    else if (isSameDay(d, now)) today += 1;
  }

  return { overdue, today, inReview, open };
}
