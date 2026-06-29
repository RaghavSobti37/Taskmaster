/** Client ESM mirror of shared/dailyLogDetails.js — keep in sync */

import { formatTimeSpent, parseTimeSpentToMinutes } from './timeSpent';
import { toDateKey } from './dateValidation';
import { formatClockTimeForDisplay } from './attendanceUtils';

export const EDIT_WINDOW_DAYS = 14;
export const TIMELINE_DAY_START_MIN = 6 * 60;
export const TIMELINE_DAY_END_MIN = 22 * 60;

export function parseClockToMinutes(timeStr) {
  if (!timeStr || !String(timeStr).includes(':')) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToClock(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeIntervalMinutes(startTime, endTime) {
  const start = parseClockToMinutes(startTime);
  const end = parseClockToMinutes(endTime);
  if (start == null || end == null) return 0;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

export function computeTimeSpentFromInterval(startTime, endTime) {
  const mins = computeIntervalMinutes(startTime, endTime);
  if (mins <= 0) return '';
  return formatTimeSpent(mins / 60);
}

export function normalizeWorkDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

export function getLogWorkDateKey(log) {
  const wd = log?.details?.workDate;
  if (wd) {
    const n = normalizeWorkDate(wd);
    if (n) return n;
  }
  return toDateKey(log?.createdAt);
}

export function readLogTimeSpentMinutes(log) {
  const d = log?.details || {};
  if (d.startTime && d.endTime) {
    const mins = computeIntervalMinutes(d.startTime, d.endTime);
    if (mins > 0) return mins;
  }
  const raw = d.timeSpent ?? log?.payload?.timeSpent;
  if (raw == null || raw === '') {
    const hours = Number(d.hours);
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
    return 0;
  }
  if (typeof raw === 'number') {
    return raw > 24 ? Math.round(raw) : Math.round(raw * 60);
  }
  return parseTimeSpentToMinutes(raw);
}

export function normalizeDailyLogDetails(details = {}) {
  const next = { ...details };
  const workDate = normalizeWorkDate(next.workDate);
  if (workDate) next.workDate = workDate;

  if (next.startTime) next.startTime = String(next.startTime).slice(0, 5);
  if (next.endTime) next.endTime = String(next.endTime).slice(0, 5);

  if (next.startTime && next.endTime) {
    next.timeSpent = computeTimeSpentFromInterval(next.startTime, next.endTime);
  }

  if (Array.isArray(next.memberIds)) {
    next.memberIds = [...new Set(next.memberIds.map(String).filter(Boolean))];
  }

  return next;
}

export function isLogEditable(log, { isAdmin = false } = {}) {
  if (isAdmin) return true;
  const workKey = getLogWorkDateKey(log);
  if (!workKey) return false;
  const today = toDateKey(new Date());
  const workDate = new Date(`${workKey}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  const diffDays = Math.floor((todayDate - workDate) / 86400000);
  return diffDays >= 0 && diffDays <= EDIT_WINDOW_DAYS;
}

const TIMELINE_FALLBACK_DURATION_MIN = 30;
const TIMELINE_MIN_BLOCK_MIN = 15;

function parseCreatedAtToMinutes(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function resolveLogTimelineBlock(log) {
  const d = log?.details || {};
  const explicitStart = d.startTime ? parseClockToMinutes(d.startTime) : null;
  const explicitEnd = d.endTime ? parseClockToMinutes(d.endTime) : null;

  if (explicitStart != null && explicitEnd != null) {
    let endMin = explicitEnd;
    if (endMin <= explicitStart) endMin += 24 * 60;
    return {
      startMin: explicitStart,
      endMin,
      estimated: false,
    };
  }

  const durationRaw = readLogTimeSpentMinutes(log);
  const durationMin = durationRaw > 0
    ? Math.max(TIMELINE_MIN_BLOCK_MIN, durationRaw)
    : TIMELINE_FALLBACK_DURATION_MIN;

  let startMin = explicitStart;
  let endMin = explicitEnd;

  if (endMin == null) {
    endMin = parseCreatedAtToMinutes(log?.createdAt);
  }
  if (endMin == null) {
    endMin = 12 * 60;
  }

  if (startMin == null) {
    startMin = endMin - durationMin;
    if (startMin < 0) startMin = 0;
  } else if (explicitEnd == null) {
    endMin = startMin + durationMin;
    if (endMin <= startMin) endMin = startMin + durationMin;
  }

  if (endMin <= startMin) {
    endMin = startMin + Math.max(TIMELINE_MIN_BLOCK_MIN, durationMin);
  }

  return { startMin, endMin, estimated: true };
}

export function getLogTimelineBounds(logs = []) {
  let firstIn = null;
  let lastOut = null;
  const blocks = [];

  for (const log of logs) {
    const d = log?.details || {};
    const { startMin, endMin, estimated } = resolveLogTimelineBlock(log);
    if (firstIn == null || startMin < firstIn) firstIn = startMin;
    if (lastOut == null || endMin > lastOut) lastOut = endMin;
    blocks.push({
      id: String(log._id),
      title: d.title || 'Work',
      startMin,
      endMin,
      message: d.message || '',
      estimated,
    });
  }

  blocks.sort((a, b) => a.startMin - b.startMin);
  return { firstIn, lastOut, blocks };
}

export function formatLogInterval(log) {
  const d = log?.details || {};
  if (d.startTime && d.endTime) {
    return `${formatClockTimeForDisplay(d.startTime, { emptyLabel: '—' })} – ${formatClockTimeForDisplay(d.endTime, { emptyLabel: '—' })}`;
  }
  return d.timeSpent || '—';
}
