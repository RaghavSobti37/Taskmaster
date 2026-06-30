import { isToday, isTomorrow, startOfDay, isBefore } from 'date-fns';
import { formatWeekdayDate } from './dateDisplay';

export function formatDueDate(date, { emptyLabel = 'No date' } = {}) {
  if (!date) return emptyLabel;
  const d = startOfDay(new Date(date));
  if (Number.isNaN(d.getTime())) return emptyLabel;
  const today = startOfDay(new Date());
  if (isBefore(d, today)) return `Overdue · ${formatWeekdayDate(d, { emptyLabel: '' })}`;
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return formatWeekdayDate(d, { emptyLabel: '' });
}
