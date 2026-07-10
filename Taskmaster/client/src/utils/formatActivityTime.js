import { formatDisplayDateTimeSeconds } from './dateDisplay';

/** Task history / header timestamps — `dd/MM/yyyy · HH:mm:ss` */
export function formatActivityTime(value) {
  if (!value) return '';
  return formatDisplayDateTimeSeconds(value, { emptyLabel: '' });
}
