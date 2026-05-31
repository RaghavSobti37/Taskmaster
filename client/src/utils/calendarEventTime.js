import { format } from 'date-fns';

/** Combine YYYY-MM-DD + HH:mm into local Date. */
export function combineDateAndTime(dateStr, timeStr = '09:00') {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh = 9, mm = 0] = (timeStr || '09:00').split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

export function extractDateAndTime(raw) {
  if (!raw) return { date: '', time: '09:00' };
  const str = String(raw);
  const datePart = str.split('T')[0];
  if (!str.includes('T')) return { date: datePart, time: '09:00' };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: datePart, time: '09:00' };
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return { date: datePart, time };
}

export function formatEventTimeLabel(raw) {
  if (!raw) return 'All day';
  const str = String(raw);
  if (!str.includes('T')) return 'All day';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'All day';
  
  // Use UTC time to avoid local timezone offset shifts
  const utcDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0);
  return format(utcDate, 'h:mma').toUpperCase();
}
