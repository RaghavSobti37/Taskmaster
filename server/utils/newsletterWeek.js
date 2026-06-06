const getISOWeekParts = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const formatWeekKey = ({ year, week }) => `${year}-W${String(week).padStart(2, '0')}`;

const getCurrentWeekKey = (date = new Date()) => formatWeekKey(getISOWeekParts(date));

const parseWeekKey = (weekKey) => {
  const match = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
};

/** Monday 00:00 UTC through Sunday 23:59:59.999 UTC for ISO week */
const getWeekBounds = (weekKey) => {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return null;
  const jan4 = new Date(Date.UTC(parsed.year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (parsed.week - 1) * 7);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: sunday };
};

module.exports = {
  getCurrentWeekKey,
  getWeekBounds,
  parseWeekKey,
  formatWeekKey,
  getISOWeekParts,
};
