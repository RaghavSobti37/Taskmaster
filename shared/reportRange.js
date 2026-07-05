const TIMEFRAME_DAYS = { all: 3650, '1d': 1, '7d': 7, '30d': 30 };

const VALID_TIMEFRAMES = Object.keys(TIMEFRAME_DAYS);

const MAX_RANGE_DAYS = 366;

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const resolveTimeframe = (value) => (VALID_TIMEFRAMES.includes(value) ? value : 'all');

const toDateKey = (input = new Date()) => {
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
};

const parseDateKey = (key) => (DATE_KEY_RE.test(String(key || '').trim()) ? String(key).trim() : null);

const keyToDate = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDaysToKey = (dateKey, delta) => {
  const d = keyToDate(dateKey);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
};

const daysBetweenKeys = (startKey, endKey) => {
  const ms = keyToDate(endKey) - keyToDate(startKey);
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
};

const buildWindow = (startKey, endKey, timeframe) => ({
  timeframe,
  days: daysBetweenKeys(startKey, endKey),
  start: keyToDate(startKey),
  end: keyToDate(endKey),
  startKey,
  endKey,
});

const capCustomRange = (startKey, endKey) => {
  const todayKey = toDateKey(new Date());
  let start = startKey;
  let end = endKey > todayKey ? todayKey : endKey;
  const minStart = addDaysToKey(todayKey, -(MAX_RANGE_DAYS - 1));
  if (start < minStart) start = minStart;
  if (start > end) start = end;
  return { startKey: start, endKey: end };
};

const getRollingWindow = (timeframe = 'all') => {
  const tf = resolveTimeframe(timeframe);
  const endKey = toDateKey(new Date());
  const days = TIMEFRAME_DAYS[tf];
  const startKey = addDaysToKey(endKey, -(days - 1));
  return buildWindow(startKey, endKey, tf);
};

const getRollingWindowFromParams = (options = {}) => {
  const startDate = parseDateKey(options.startDate);
  const endDate = parseDateKey(options.endDate);

  if (startDate && endDate) {
    let startKey = startDate;
    let endKey = endDate;
    if (startKey > endKey) {
      [startKey, endKey] = [endKey, startKey];
    }
    const capped = capCustomRange(startKey, endKey);
    return buildWindow(capped.startKey, capped.endKey, 'custom');
  }

  return getRollingWindow(options.timeframe);
};

const resolveRollingRange = (query = {}) => getRollingWindowFromParams({
  timeframe: query.timeframe,
  startDate: query.startDate,
  endDate: query.endDate,
});

const dateKeysInWindow = (window) => {
  const keys = [];
  let cursor = window.startKey;
  while (cursor <= window.endKey) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return keys;
};

const inRollingWindow = (dateKey, window) => {
  if (!dateKey) return false;
  return dateKey >= window.startKey && dateKey <= window.endKey;
};

module.exports = {
  TIMEFRAME_DAYS,
  VALID_TIMEFRAMES,
  MAX_RANGE_DAYS,
  resolveTimeframe,
  toDateKey,
  getRollingWindow,
  getRollingWindowFromParams,
  resolveRollingRange,
  dateKeysInWindow,
  inRollingWindow,
};
