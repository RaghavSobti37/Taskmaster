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

module.exports = {
  APP_TIMEZONE,
  getDateKey,
  startOfDayFromKey,
  endOfDayFromKey,
  toStartOfDay,
  todayStart,
  formatHHMM,
  isWeekend,
};
