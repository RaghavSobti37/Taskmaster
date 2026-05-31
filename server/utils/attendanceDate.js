const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const TZ_OFFSETS = {
  'Asia/Kolkata': '+05:30',
  UTC: '+00:00',
};

const getTzOffset = () => TZ_OFFSETS[APP_TIMEZONE] || '+05:30';

const getDateKey = (input = new Date()) => {
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
};

const startOfDayFromKey = (dateKey) => {
  if (!dateKey) return startOfDayFromKey(getDateKey());
  if (dateKey instanceof Date) return startOfDayFromKey(getDateKey(dateKey));
  if (typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) {
    return new Date(`${dateKey.trim()}T00:00:00${getTzOffset()}`);
  }
  return startOfDayFromKey(getDateKey(new Date(dateKey)));
};

const endOfDayFromKey = (dateKey) => {
  const key = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())
    ? dateKey.trim()
    : getDateKey(dateKey);
  return new Date(`${key}T23:59:59.999${getTzOffset()}`);
};

const toStartOfDay = (date) => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return startOfDayFromKey(date.trim());
  }
  return startOfDayFromKey(getDateKey(date instanceof Date ? date : new Date(date)));
};

const todayStart = () => startOfDayFromKey(getDateKey());

const todayEnd = () => endOfDayFromKey(getDateKey());

const getISTDate = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const date = new Date(
    parseInt(parts.find(p => p.type === 'year').value),
    parseInt(parts.find(p => p.type === 'month').value) - 1,
    parseInt(parts.find(p => p.type === 'day').value),
    parseInt(parts.find(p => p.type === 'hour').value),
    parseInt(parts.find(p => p.type === 'minute').value),
    parseInt(parts.find(p => p.type === 'second').value)
  );
  return date;
};

const formatHHMM = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const getWeekdayInTz = (input = new Date()) => {
  const value = input instanceof Date ? input : new Date(input);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(value);
  return weekday;
};

const isWeekend = (input = new Date()) => {
  const weekday = getWeekdayInTz(input);
  return weekday === 'Sat' || weekday === 'Sun';
};

const WEEKDAY_OFFSET_FROM_MONDAY = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || !String(timeStr).includes(':')) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h * 60) + (m || 0);
};

const toDateKeyAnchor = (dateKey) => new Date(`${dateKey}T12:00:00${getTzOffset()}`);

const getMondayDateKey = (referenceInput) => {
  const dateKey = typeof referenceInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceInput.trim())
    ? referenceInput.trim()
    : getDateKey(referenceInput instanceof Date ? referenceInput : new Date(referenceInput || Date.now()));
  const anchor = toDateKeyAnchor(dateKey);
  const weekday = getWeekdayInTz(anchor);
  const daysFromMonday = WEEKDAY_OFFSET_FROM_MONDAY[weekday] ?? 0;
  anchor.setDate(anchor.getDate() - daysFromMonday);
  return getDateKey(anchor);
};

const getCurrentWeekRange = (weekStartInput) => {
  const mondayKey = weekStartInput
    ? getMondayDateKey(weekStartInput)
    : getMondayDateKey(getDateKey());

  const weekStart = startOfDayFromKey(mondayKey);
  const sundayAnchor = toDateKeyAnchor(mondayKey);
  sundayAnchor.setDate(sundayAnchor.getDate() + 6);
  const sundayKey = getDateKey(sundayAnchor);
  const weekEnd = endOfDayFromKey(sundayKey);

  return { weekStart, weekEnd, weekStartKey: mondayKey, weekEndKey: sundayKey };
};

const validateAttendanceTimes = ({ dateKey, timeIn, timeOut, onLeave, isHalfDay }) => {
  const todayKey = getDateKey();
  const now = new Date();
  const normalizedDateKey = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())
    ? dateKey.trim()
    : getDateKey(dateKey);

  if (onLeave) return { ok: true };

  const hasTimes = !!(timeIn || timeOut);
  if (normalizedDateKey > todayKey && hasTimes) {
    return { ok: false, error: 'Cannot set times for a future date' };
  }

  const checkFuture = (time) => {
    if (!time) return false;
    const dt = new Date(`${normalizedDateKey}T${time}:00${getTzOffset()}`);
    return dt > now;
  };

  if (checkFuture(timeIn)) {
    return { ok: false, error: 'Time in cannot be in the future' };
  }
  if (checkFuture(timeOut)) {
    return { ok: false, error: 'Time out cannot be in the future' };
  }
  if (timeIn && timeOut && parseTimeToMinutes(timeOut) < parseTimeToMinutes(timeIn)) {
    return { ok: false, error: 'Time out must be after time in' };
  }
  if (isHalfDay && !timeIn && !timeOut) {
    return { ok: false, error: 'Half day requires at least a time in or time out' };
  }

  return { ok: true };
};

module.exports = {
  APP_TIMEZONE,
  getDateKey,
  startOfDayFromKey,
  endOfDayFromKey,
  toStartOfDay,
  todayStart,
  todayEnd,
  getISTDate,
  formatHHMM,
  isWeekend,
  getMondayDateKey,
  getCurrentWeekRange,
  validateAttendanceTimes,
  parseTimeToMinutes,
};
