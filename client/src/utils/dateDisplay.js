import { format, parse, parseISO, isValid } from 'date-fns';
import { DEFAULT_TZ } from './dateValidation';
import { getActiveDateFormatPatterns } from './dateFormatRegistry';
import { getDobPlaceholder } from '@shared/dateFormatPreference';

/** Legacy constants — default DD/MM/YYYY; runtime uses active user preference. */
export const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';
export const DATE_DISPLAY_SHORT_FORMAT = 'dd/MM';
export const DATETIME_DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm';
export const DATETIME_DISPLAY_SECONDS_FORMAT = 'dd/MM/yyyy HH:mm:ss';
export const WEEKDAY_DATE_DISPLAY_FORMAT = 'EEE, dd/MM/yyyy';
export const WEEKDAY_DATE_LONG_DISPLAY_FORMAT = 'EEEE, dd/MM/yyyy';

const EMPTY = '—';

function patterns() {
  return getActiveDateFormatPatterns();
}

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
  return format(d, patterns().date);
}

export function formatDisplayDateShort(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, patterns().dateShort);
}

export function formatDisplayDateTime(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, patterns().datetime);
}

export function formatDisplayDateTimeSeconds(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, patterns().datetimeSeconds);
}

/** IST-aware calendar date in active user format. */
export function formatDisplayDateIST(value, { emptyLabel = EMPTY, timeZone = DEFAULT_TZ } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === 'day')?.value || 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value || 0);
  const year = Number(parts.find((p) => p.type === 'year')?.value || 0);
  if (!day || !month || !year) return emptyLabel;
  return format(new Date(year, month - 1, day), patterns().date);
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

export function formatWeekdayDate(value, options) {
  return formatDisplayDate(value, options);
}

export function formatWeekdayDateLong(value, options) {
  return formatDisplayDate(value, options);
}

/** Parse yyyy-MM-dd or ISO timestamp to display date. */
export function formatDateKeyForDisplay(dateKey, { emptyLabel = EMPTY, withWeekday = false } = {}) {
  if (!dateKey) return emptyLabel;
  if (typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) {
    const d = parseISO(dateKey.trim());
    if (!isValid(d)) return emptyLabel;
    return format(d, patterns().date);
  }
  return formatDisplayDate(dateKey, { emptyLabel });
}

export function formatDisplayDateTime12h(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, patterns().datetime12h);
}

export function formatDisplayDateTime12hComma(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return format(d, patterns().datetime12hComma);
}

/** Profile DOB text field — uses active display format. */
export function formatDobInput(value) {
  const d = coerceDate(value);
  if (!d) return '';
  return format(d, patterns().dobParse);
}

/** Parse profile DOB using active display format (or yyyy-MM-dd). */
export function parseDobInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: true, value: null };

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const iso = parseISO(raw);
    return isValid(iso) ? { ok: true, value: raw } : { ok: false, error: 'Invalid date' };
  }

  const parsePattern = patterns().dobParse;
  const parsed = parse(raw, parsePattern, new Date());
  if (!isValid(parsed)) {
    return { ok: false, error: `Use ${getDobPlaceholder(patterns())}` };
  }
  return { ok: true, value: format(parsed, 'yyyy-MM-dd') };
}

export function getActiveDobPlaceholder() {
  return getDobPlaceholder(patterns());
}
