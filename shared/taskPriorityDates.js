/** Calendar days between start date and due date, keyed by priority. */
const PRIORITY_DAY_SPAN = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function getPriorityDaySpan(priority) {
  return PRIORITY_DAY_SPAN[String(priority || 'medium').toLowerCase()] ?? PRIORITY_DAY_SPAN.medium;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateInput(value) {
  if (!value) return startOfLocalDay(new Date());
  if (value instanceof Date && !Number.isNaN(value.getTime())) return startOfLocalDay(value);
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? startOfLocalDay(new Date()) : startOfLocalDay(fallback);
}

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addCalendarDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Returns yyyy-MM-dd due date = start + priority day span (calendar days). */
function computeDueDateFromStart(startDate, priority) {
  const days = getPriorityDaySpan(priority);
  return formatYmd(addCalendarDays(parseDateInput(startDate), days));
}

function sameCalendarDay(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return parseDateInput(a).getTime() === parseDateInput(b).getTime();
}

/**
 * Normalize due date from start + priority when appropriate.
 * @param {object} coreData - incoming task fields
 * @param {object|null} existing - existing task on update
 */
function applyPriorityDueDate(coreData, existing = null) {
  const priority = coreData.priority ?? existing?.priority ?? 'medium';
  const startAnchor = coreData.scheduleDate ?? existing?.scheduleDate ?? new Date();

  const priorityChanged = coreData.priority !== undefined
    && existing
    && String(coreData.priority).toLowerCase() !== String(existing.priority || 'medium').toLowerCase();
  const scheduleChanged = coreData.scheduleDate !== undefined
    && existing
    && !sameCalendarDay(coreData.scheduleDate, existing.scheduleDate);
  const dueProvided = coreData.dueDate !== undefined && coreData.dueDate !== null && coreData.dueDate !== '';

  if (!existing) {
    if (!dueProvided) {
      coreData.dueDate = computeDueDateFromStart(startAnchor, priority);
    }
    return coreData;
  }

  if (priorityChanged || scheduleChanged) {
    coreData.dueDate = computeDueDateFromStart(startAnchor, priority);
    return coreData;
  }

  if (!dueProvided && !existing.dueDate) {
    coreData.dueDate = computeDueDateFromStart(startAnchor, priority);
  }

  return coreData;
}

module.exports = {
  PRIORITY_DAY_SPAN,
  getPriorityDaySpan,
  computeDueDateFromStart,
  applyPriorityDueDate,
};
