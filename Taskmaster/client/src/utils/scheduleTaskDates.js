/** Client ESM mirror of shared/scheduleTaskDates.js — keep in sync */

import { toDateKey } from './dateValidation';

export function addDaysToDateKey(dateKey, days) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const dt = new Date(`${dateKey}T12:00:00+05:30`);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

export function dateKeysInRange(rangeStartKey, rangeEndKey) {
  if (!rangeStartKey || !rangeEndKey || rangeStartKey > rangeEndKey) return [];
  const keys = [];
  let cur = rangeStartKey;
  while (cur <= rangeEndKey) {
    keys.push(cur);
    const next = addDaysToDateKey(cur, 1);
    if (!next || next === cur) break;
    cur = next;
  }
  return keys;
}

export function resolveTaskSpan(task) {
  const startKey =
    toDateKey(task?.startDate) || toDateKey(task?.scheduleDate) || toDateKey(task?.dueDate);
  const endKey =
    toDateKey(task?.dueDate) || toDateKey(task?.startDate) || toDateKey(task?.scheduleDate);
  if (!startKey && !endKey) return null;
  let start = startKey || endKey;
  let end = endKey || startKey;
  if (start > end) [start, end] = [end, start];
  return { start, end };
}

export function spanCoversDateKey(span, dateKey) {
  if (!span || !dateKey) return false;
  return span.start <= dateKey && span.end >= dateKey;
}

function taskOverlapsRange(task, rangeStartKey, rangeEndKey) {
  const span = resolveTaskSpan(task);
  if (!span) return false;
  return span.start <= rangeEndKey && span.end >= rangeStartKey;
}

/** Single-day anchor for workload (prefers explicit scheduleDate). */
function getScheduleAnchorKey(task) {
  return (
    toDateKey(task?.scheduleDate) ||
    toDateKey(task?.startDate) ||
    resolveTaskSpan(task)?.start ||
    null
  );
}

function totalSpanDaysInRange(task, rangeStartKey, rangeEndKey) {
  const span = resolveTaskSpan(task);
  if (!span) return 0;
  let count = 0;
  for (const key of dateKeysInRange(rangeStartKey, rangeEndKey)) {
    if (spanCoversDateKey(span, key)) count += 1;
  }
  return count;
}
