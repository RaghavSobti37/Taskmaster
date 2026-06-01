const DEFAULT_TZ = 'Asia/Kolkata';

export function toDateKey(value, timeZone = DEFAULT_TZ) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function getTodayDateKey(timeZone = DEFAULT_TZ) {
  return toDateKey(new Date(), timeZone);
}

export function assertDateKeyNotBeforeToday(dateKey, { label = 'Date', timeZone = DEFAULT_TZ } = {}) {
  if (dateKey == null || dateKey === '') return { ok: true };
  const key = toDateKey(dateKey, timeZone);
  if (!key) return { ok: false, error: `Invalid ${label.toLowerCase()}` };
  const today = getTodayDateKey(timeZone);
  if (key < today) {
    return { ok: false, error: `${label} cannot be in the past` };
  }
  return { ok: true };
}

export function validateTaskTimelineFields(fields, timeZone = DEFAULT_TZ) {
  const checks = [
    ['scheduleDate', 'Start date'],
    ['dueDate', 'Due date'],
    ['startDate', 'Start date'],
  ];
  for (const [field, label] of checks) {
    if (fields[field] != null && fields[field] !== '') {
      const result = assertDateKeyNotBeforeToday(fields[field], { label, timeZone });
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

export function buildDateTimeFromParts(dateKey, timeStr = '00:00', tzOffset = '+05:30') {
  const key = toDateKey(dateKey);
  if (!key) return null;
  const time = /^\d{1,2}:\d{2}$/.test(String(timeStr || '')) ? String(timeStr) : '00:00';
  const [h, m] = time.split(':').map(Number);
  return new Date(
    `${key}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${tzOffset}`
  );
}

export function validateCalendarEventRange(
  { startDate, startTime, endDate, endTime },
  { timeZone = DEFAULT_TZ, tzOffset = '+05:30' } = {}
) {
  const start = buildDateTimeFromParts(startDate, startTime || '09:00', tzOffset);
  const end = buildDateTimeFromParts(endDate || startDate, endTime || startTime || '09:00', tzOffset);

  if (!start || !end) {
    return { ok: false, error: 'Invalid event date or time' };
  }
  if (end < start) {
    return { ok: false, error: 'End date/time must be after start date/time' };
  }

  const startKey = toDateKey(start, timeZone);
  const today = getTodayDateKey(timeZone);
  if (startKey < today) {
    return { ok: false, error: 'Event start cannot be in the past' };
  }
  if (startKey === today && start < new Date()) {
    return { ok: false, error: 'Event start time cannot be in the past' };
  }

  return { ok: true, start, end };
}

export { DEFAULT_TZ };
