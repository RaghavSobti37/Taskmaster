import { startOfDay } from 'date-fns';
import { formatDisplayDateShort } from './dateDisplay';

export function formatDueDate(date, { emptyLabel = 'No date' } = {}) {
  if (!date) return emptyLabel;
  const d = startOfDay(new Date(date));
  if (Number.isNaN(d.getTime())) return emptyLabel;
  return formatDisplayDateShort(d, { emptyLabel });
}
