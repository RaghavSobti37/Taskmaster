import { format } from 'date-fns';

/** Default calendar wall time (IST) for date-only tasks and events without an explicit time. */
export const DEFAULT_EVENT_TIME = '09:00';
/** UTC hour:minute that renders as 9:00 AM IST via formatTimeFromParts (matches buildDateTimeFromParts storage). */
const DEFAULT_EVENT_TIME_UTC = '03:30';

/** Combine YYYY-MM-DD + HH:mm into UTC Date (matches server storage). */
export function combineDateAndTime(dateStr, timeStr = DEFAULT_EVENT_TIME) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh = 9, mm = 0] = (timeStr || DEFAULT_EVENT_TIME).split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

export function extractDateAndTime(raw) {
  if (!raw) return { date: '', time: DEFAULT_EVENT_TIME_UTC };
  const str = String(raw);
  const datePart = str.split('T')[0];
  if (!str.includes('T')) return { date: datePart, time: DEFAULT_EVENT_TIME_UTC };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: datePart, time: DEFAULT_EVENT_TIME_UTC };
  let time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  // Midnight UTC = date-only task dueDate sentinel (would otherwise show as 5:30 AM IST).
  if (time === '00:00') time = DEFAULT_EVENT_TIME_UTC;
  return { date: datePart, time };
}

export function extractEventRange(event) {
  const start = extractDateAndTime(event?.date || event?.dueDate);
  const end = event?.endDate
    ? extractDateAndTime(event.endDate)
    : { date: start.date, time: start.time };
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}

function formatTimeFromParts(timeStr) {
  if (!timeStr) return '';
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, hh, mm, 0, 0));
  return format(d, 'h:mma').toUpperCase();
}

export function formatEventTimeLabel(raw) {
  return formatEventRangeLabel(raw, null);
}

/** Start–end label for calendar events (single time if no end or same instant). */
export function formatEventRangeLabel(startRaw, endRaw) {
  if (!startRaw) return formatTimeFromParts(DEFAULT_EVENT_TIME_UTC);
  const start = extractDateAndTime(startRaw);
  const end = endRaw ? extractDateAndTime(endRaw) : start;
  const hasTime = String(startRaw).includes('T') || (endRaw && String(endRaw).includes('T'));

  if (!hasTime) return formatTimeFromParts(DEFAULT_EVENT_TIME_UTC);

  if (start.date === end.date) {
    if (start.time === end.time) return formatTimeFromParts(start.time);
    return `${formatTimeFromParts(start.time)} – ${formatTimeFromParts(end.time)}`;
  }

  const startDateLabel = format(new Date(`${start.date}T12:00:00`), 'MMM d');
  const endDateLabel = format(new Date(`${end.date}T12:00:00`), 'MMM d');
  return `${startDateLabel} ${formatTimeFromParts(start.time)} – ${endDateLabel} ${formatTimeFromParts(end.time)}`;
}

/** True if `day` (Date) falls within event start/end (inclusive, date-only). */
export function normalizeMeetingLink(link) {
  const trimmed = (link || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function eventOccursOnDay(event, day) {
  if (!day) return false;
  const start = extractDateAndTime(event?.date || event?.dueDate);
  if (!start.date) return false;
  const end = event?.endDate ? extractDateAndTime(event.endDate) : start;
  const dayKey = format(day, 'yyyy-MM-dd');
  return dayKey >= start.date && dayKey <= end.date;
}
