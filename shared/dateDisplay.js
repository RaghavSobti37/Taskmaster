const { format, parseISO, isValid } = require('date-fns');

const DEFAULT_TZ = 'Asia/Kolkata';

const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';
const DATE_DISPLAY_SHORT_FORMAT = 'dd/MM';
const DATETIME_DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm';
const DATETIME_DISPLAY_SECONDS_FORMAT = 'dd/MM/yyyy HH:mm:ss';

const EMPTY = '—';

function coerceDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplayDate(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATE_DISPLAY_FORMAT);
}

function formatDisplayDateShort(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATE_DISPLAY_SHORT_FORMAT);
}

function formatDisplayDateTime(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATETIME_DISPLAY_FORMAT);
}

function formatDisplayDateTimeSeconds(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATETIME_DISPLAY_SECONDS_FORMAT);
}

function formatDisplayDateIST(value, { emptyLabel = EMPTY, timeZone = DEFAULT_TZ } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function formatDateKeyForDisplay(dateKey, { emptyLabel = EMPTY } = {}) {
  if (!dateKey) return emptyLabel;
  if (typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) {
    const d = parseISO(dateKey.trim());
    if (!isValid(d)) return emptyLabel;
    return format(d, DATE_DISPLAY_FORMAT);
  }
  return formatDisplayDate(dateKey, { emptyLabel });
}

function formatWeekdayDateLong(value, { emptyLabel = EMPTY, timeZone = DEFAULT_TZ } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

module.exports = {
  DEFAULT_TZ,
  DATE_DISPLAY_FORMAT,
  DATE_DISPLAY_SHORT_FORMAT,
  DATETIME_DISPLAY_FORMAT,
  DATETIME_DISPLAY_SECONDS_FORMAT,
  formatDisplayDate,
  formatDisplayDateShort,
  formatDisplayDateTime,
  formatDisplayDateTimeSeconds,
  formatDisplayDateIST,
  formatDateKeyForDisplay,
  formatWeekdayDateLong,
};
