import { format, parseISO, isValid } from 'date-fns';
import { DEFAULT_TZ } from './dateValidation';

/** User-facing date convention: DD/MM/YYYY (date-fns tokens). */
export const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';
export const DATE_DISPLAY_SHORT_FORMAT = 'dd/MM';
export const DATETIME_DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm';
export const DATETIME_DISPLAY_SECONDS_FORMAT = 'dd/MM/yyyy HH:mm:ss';
export const WEEKDAY_DATE_DISPLAY_FORMAT = 'EEE, dd/MM/yyyy';
export const WEEKDAY_DATE_LONG_DISPLAY_FORMAT = 'EEEE, dd/MM/yyyy';

const EMPTY = '—';

function coerceDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDisplayDate(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATE_DISPLAY_FORMAT);
}

export function formatDisplayDateShort(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATE_DISPLAY_SHORT_FORMAT);
}

export function formatDisplayDateTime(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATETIME_DISPLAY_FORMAT);
}

export function formatDisplayDateTimeSeconds(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, DATETIME_DISPLAY_SECONDS_FORMAT);
}

/** IST-aware calendar date (en-GB → dd/MM/yyyy in app timezone). */
export function formatDisplayDateIST(value, { emptyLabel = EMPTY, timeZone = DEFAULT_TZ } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDisplayDateTimeIST(value, { emptyLabel = EMPTY, timeZone = DEFAULT_TZ } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  const datePart = formatDisplayDateIST(d, { emptyLabel: '', timeZone });
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${datePart} ${timePart}`;
}

export function formatWeekdayDate(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, WEEKDAY_DATE_DISPLAY_FORMAT);
}

export function formatWeekdayDateLong(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, WEEKDAY_DATE_LONG_DISPLAY_FORMAT);
}

/** Parse yyyy-MM-dd or ISO timestamp to display date. */
export function formatDateKeyForDisplay(dateKey, { emptyLabel = EMPTY } = {}) {
  if (!dateKey) return emptyLabel;
  if (typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) {
    const d = parseISO(dateKey.trim());
    if (!isValid(d)) return emptyLabel;
    return format(d, DATE_DISPLAY_FORMAT);
  }
  return formatDisplayDate(dateKey, { emptyLabel });
}

export function formatDisplayDateTime12h(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, 'dd/MM/yyyy h:mm a');
}

export function formatDisplayDateTime12hComma(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, 'dd/MM/yyyy, hh:mm a');
}
