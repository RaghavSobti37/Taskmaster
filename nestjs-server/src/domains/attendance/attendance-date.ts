const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const TZ_OFFSETS: Record<string, string> = {
  'Asia/Kolkata': '+05:30',
  UTC: '+00:00',
};

const getTzOffset = () => TZ_OFFSETS[APP_TIMEZONE] || '+05:30';

export const getDateKey = (input: Date | string = new Date()): string | null => {
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
};

const startOfDayFromKey = (dateKey?: string | Date | null): Date => {
  if (!dateKey) return startOfDayFromKey(getDateKey());
  if (dateKey instanceof Date) return startOfDayFromKey(getDateKey(dateKey));
  if (typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) {
    return new Date(`${dateKey.trim()}T00:00:00${getTzOffset()}`);
  }
  return startOfDayFromKey(getDateKey(new Date(dateKey)));
};

export const endOfDayFromKey = (dateKey: string | Date): Date => {
  const key = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())
    ? dateKey.trim()
    : getDateKey(dateKey);
  return new Date(`${key}T23:59:59.999${getTzOffset()}`);
};

export const toStartOfDay = (date: string | Date): Date => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return startOfDayFromKey(date.trim());
  }
  return startOfDayFromKey(getDateKey(date instanceof Date ? date : new Date(date)));
};

export const todayStart = () => startOfDayFromKey(getDateKey());

export const formatHHMM = (date: Date = new Date()): string => {
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

const getWeekdayInTz = (input: Date | string = new Date()) => {
  const value = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(value);
};

const WEEKDAY_OFFSET_FROM_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const toDateKeyAnchor = (dateKey: string) => new Date(`${dateKey}T12:00:00${getTzOffset()}`);

const getMondayDateKey = (referenceInput?: string | Date) => {
  const dateKey = typeof referenceInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceInput.trim())
    ? referenceInput.trim()
    : getDateKey(referenceInput instanceof Date ? referenceInput : new Date(referenceInput || Date.now()));
  const anchor = toDateKeyAnchor(dateKey || getDateKey() || '');
  const weekday = getWeekdayInTz(anchor);
  const daysFromMonday = WEEKDAY_OFFSET_FROM_MONDAY[weekday] ?? 0;
  anchor.setDate(anchor.getDate() - daysFromMonday);
  return getDateKey(anchor);
};

export const getCurrentWeekRange = (weekStartInput?: string) => {
  const mondayKey = weekStartInput
    ? getMondayDateKey(weekStartInput)
    : getMondayDateKey(getDateKey() || undefined);

  const weekStart = startOfDayFromKey(mondayKey);
  const sundayAnchor = toDateKeyAnchor(mondayKey || '');
  sundayAnchor.setDate(sundayAnchor.getDate() + 6);
  const sundayKey = getDateKey(sundayAnchor);
  const weekEnd = endOfDayFromKey(sundayKey || '');

  return { weekStart, weekEnd, weekStartKey: mondayKey, weekEndKey: sundayKey };
};

export const getWeekRange = getCurrentWeekRange;
