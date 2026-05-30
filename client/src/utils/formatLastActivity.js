import { format, isToday, isYesterday } from 'date-fns';

/**
 * Formats lastOnline for the users table:
 * Today · 3:45 PM | Yesterday · 9:12 AM | May 28, 2026 · 3:45 PM
 */
export function formatLastActivity(value, { emptyLabel = 'No record' } = {}) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today · ${time}`;
  if (isYesterday(date)) return `Yesterday · ${time}`;
  return `${format(date, 'MMM dd, yyyy')} · ${time}`;
}
