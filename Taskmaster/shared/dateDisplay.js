// ponytail: stdlib only — shared/ is outside npm workspaces; date-fns not hoisted on Render

const DEFAULT_TZ = 'Asia/Kolkata';

const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';
const DATE_DISPLAY_SHORT_FORMAT = 'dd/MM/yyyy';
const DATETIME_DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm';
const DATETIME_DISPLAY_SECONDS_FORMAT = 'dd/MM/yyyy HH:mm:ss';

const EMPTY = '—';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function coerceDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string') return null;
  const trimmed = dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, day] = trimmed.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDdMmYyyy(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDdMm(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function formatDdMmYyyyHhMm(d) {
  return `${formatDdMmYyyy(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDdMmYyyyHhMmSs(d) {
  return `${formatDdMmYyyy(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDisplayDate(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return formatDdMmYyyy(d);
}

function formatDisplayDateShort(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return formatDdMm(d);
}

function formatDisplayDateTime(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return formatDdMmYyyyHhMm(d);
}

function formatDisplayDateTimeSeconds(value, { emptyLabel = EMPTY } = {}) {
  const d = coerceDate(value);
  if (!d) return emptyLabel;
  return formatDdMmYyyyHhMmSs(d);
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
  const d = parseDateKey(dateKey);
  if (d) return formatDdMmYyyy(d);
  return formatDisplayDate(dateKey, { emptyLabel });
}

/** DD/MM/YYYY only — weekday labels removed app-wide */
function formatWeekdayDateLong(value, options) {
  return formatDisplayDate(value, options);
}

function formatDisplayDateTimeIST(value, { emptyLabel = EMPTY, timeZone = DEFAULT_TZ } = {}) {
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
  formatDisplayDateTimeIST,
};
