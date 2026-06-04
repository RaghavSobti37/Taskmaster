import { format } from 'date-fns';

/** Task history / header timestamps — `MMM dd, yyyy · HH:mm:ss` */
export function formatActivityTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'MMM dd, yyyy · HH:mm:ss');
}
