/** Client ESM mirror of shared/attendanceMetrics.js — keep in sync */

import { parseTimeSpentToMinutes } from './timeSpent';
import { toDateKey } from './dateValidation';
import { formatDateKeyIST } from './attendanceUtils';

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

export function readLogTimeSpentMinutes(log) {
  const details = log?.details || {};
  const payload = log?.payload || {};
  const raw = details.timeSpent ?? details.time ?? payload.timeSpent ?? payload.time;
  if (raw == null || raw === '') {
    const hours = Number(details.hours);
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
    return 0;
  }
  if (typeof raw === 'number') {
    return raw > 24 ? Math.round(raw) : Math.round(raw * 60);
  }
  return parseTimeSpentToMinutes(raw);
}

export function filterLogsForDateKey(logs = [], dateKey) {
  if (!dateKey) return [];
  return logs.filter((log) => toDateKey(log.createdAt) === dateKey);
}

export function getLoggedMinutesFromEntry(entry) {
  return Math.round((Number(entry?.loggedHours) || 0) * 60);
}

export function getUnloggedMinutesFromEntry(entry, { loggedMinutesOverride } = {}) {
  const worked = getWorkedMinutesFromEntry(entry);
  const logged = loggedMinutesOverride != null
    ? loggedMinutesOverride
    : getLoggedMinutesFromEntry(entry);
  const expected = Math.max(0, worked - LUNCH_BREAK_MINUTES);
  return Math.max(0, expected - logged);
}

/** Sum minutes from daily log rows (manual + task completion + review). */
export function sumDailyLogMinutes(logs = []) {
  return logs.reduce((sum, log) => sum + readLogTimeSpentMinutes(log), 0);
}

/** IST date key for an attendance row — matches server log day filter. */
export function getAttendanceDateKey(entry) {
  if (!entry?.date) return null;
  return formatDateKeyIST(entry.date);
}

/** Logged minutes from live daily logs for the attendance row's day. */
export function getLoggedMinutesFromDailyLogs(entry, dailyLogs = []) {
  const dateKey = getAttendanceDateKey(entry);
  if (!dateKey) return null;
  const dayLogs = (dailyLogs || []).filter((l) => l.action === 'DAILY_LOG');
  return sumDailyLogMinutes(filterLogsForDateKey(dayLogs, dateKey));
}
