/** Client ESM mirror of shared/timeSpent.js — keep in sync */

/** Minimum time logged when completing a task (30 minutes). */
export const MIN_COMPLETION_MINUTES = 30;

/** Review credit for assigner (15 minutes). */
export const REVIEW_TIME_MINUTES = 15;

/**
 * Parse a timeSpent string to total minutes.
 * Supports: "1h 30m", "1.5h", "30m", "90" (legacy bare minutes).
 */
export function parseTimeSpentToMinutes(raw = '') {
  const str = String(raw || '').trim().toLowerCase();
  if (!str) return 0;

  let total = 0;
  const hoursMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
  const minsMatch = str.match(/(\d+)\s*m/);

  if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
  if (minsMatch) total += parseInt(minsMatch[1], 10);

  if (!hoursMatch && !minsMatch) {
    const n = Number(str);
    if (Number.isFinite(n)) total += n;
  }

  return Math.round(total);
}

/** Parse timeSpent string to decimal hours. */
export function parseTimeSpentToHours(raw = '') {
  return parseTimeSpentToMinutes(raw) / 60;
}

/** Decimal hours → { hours, minutes }. */
export function decimalToHoursMinutes(decimal) {
  const totalMinutes = Math.round(Number(decimal) * 60);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return { hours: 0, minutes: 0 };
  }
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

/** Separate hour/minute inputs → decimal hours (rounded to nearest minute). */
export function hoursMinutesToDecimal(hours, minutes) {
  const h = Math.max(0, parseInt(String(hours ?? ''), 10) || 0);
  const m = Math.max(0, Math.min(59, parseInt(String(minutes ?? ''), 10) || 0));
  return Math.round(h * 60 + m) / 60;
}

/** Decimal hours → display string for logs ("1h 30m", "30m", "1h"). */
export function formatTimeSpent(decimalHours) {
  const { hours, minutes } = decimalToHoursMinutes(decimalHours);
  if (hours === 0 && minutes === 0) return '0m';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Decimal hours → "10h 54m" display (alias for dashboards). */
export function formatHoursMinutes(hours) {
  return formatTimeSpent(hours);
}

/** True when separate h/m inputs meet minimum completion time. */
export function isValidCompletionMinutes(hours, minutes) {
  const h = Math.max(0, parseInt(String(hours ?? ''), 10) || 0);
  const m = Math.max(0, Math.min(59, parseInt(String(minutes ?? ''), 10) || 0));
  return h * 60 + m >= MIN_COMPLETION_MINUTES;
}
