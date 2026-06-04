/** Client ESM mirror of shared/attendanceMetrics.js — keep in sync */

import { parseTimeSpentToMinutes } from './timeSpent';

export const LUNCH_BREAK_MINUTES = 60;
export const UNLOGGED_THRESHOLD_MINUTES = 30;

export function parseClockToMinutes(timeStr) {
  if (!timeStr || !String(timeStr).includes(':')) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h * 60) + (m || 0);
}

export function getWorkedMinutesFromEntry(entry) {
  const inTime = entry?.inTimeRecord?.manualTimestamp;
  const outTime = entry?.outTimeRecord?.manualTimestamp;
  if (inTime && outTime) {
    let minutes = parseClockToMinutes(outTime) - parseClockToMinutes(inTime);
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
  }
  return Math.round((Number(entry?.systemHours) || 0) * 60);
}

export function getLoggedMinutesFromEntry(entry) {
  return Math.round((Number(entry?.loggedHours) || 0) * 60);
}

export function getUnloggedMinutesFromEntry(entry) {
  const worked = getWorkedMinutesFromEntry(entry);
  const logged = getLoggedMinutesFromEntry(entry);
  const expected = Math.max(0, worked - LUNCH_BREAK_MINUTES);
  return Math.max(0, expected - logged);
}

/** Sum minutes from daily log rows (same shapes as API). */
export function sumDailyLogMinutes(logs = []) {
  return logs.reduce(
    (sum, log) => sum + parseTimeSpentToMinutes(log?.details?.timeSpent),
    0
  );
}
