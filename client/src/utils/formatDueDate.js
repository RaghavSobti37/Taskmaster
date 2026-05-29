import { format, isToday, isTomorrow, startOfDay } from 'date-fns';

export function formatDueDate(date, { emptyLabel = 'No date' } = {}) {
  if (!date) return emptyLabel;
  const d = startOfDay(new Date(date));
  if (Number.isNaN(d.getTime())) return emptyLabel;
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}
