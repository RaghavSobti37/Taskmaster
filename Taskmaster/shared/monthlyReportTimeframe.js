const TIMEFRAME_DAYS = { '1d': 1, '7d': 7, '30d': 30 };

const VALID_TIMEFRAMES = Object.keys(TIMEFRAME_DAYS);

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const resolveTimeframe = (value) => (VALID_TIMEFRAMES.includes(value) ? value : '30d');

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

const getMonthBounds = (monthParam) => {
  const [year, month] = monthParam.split('-').map(Number);
  const monthStartKey = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEndKey = toDateKey(new Date(year, month, 0));
  const todayKey = toDateKey(new Date());
  const maxEndKey = todayKey < monthEndKey ? todayKey : monthEndKey;
  return { monthStartKey, maxEndKey };
};

const clipKeysToMonth = (startKey, endKey, monthParam) => {
  const { monthStartKey, maxEndKey } = getMonthBounds(monthParam);
  let start = startKey;
  let end = endKey;
  if (start < monthStartKey) start = monthStartKey;
  if (end > maxEndKey) end = maxEndKey;
  if (start > end) start = end;
  return { startKey: start, endKey: end };
};

const buildWindow = (startKey, endKey, timeframe) => {
  const startParts = startKey.split('-').map(Number);
  const endParts = endKey.split('-').map(Number);
  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.round((end - start) / msPerDay) + 1);

  return {
    timeframe,
    days,
    start,
    end,
    startKey,
    endKey,
  };
};

const getWindowForMonth = (monthParam, timeframe = '30d') => {
  const tf = resolveTimeframe(timeframe);
  const { monthStartKey, maxEndKey: endKey } = getMonthBounds(monthParam);
  const days = TIMEFRAME_DAYS[tf];

  const endParts = endKey.split('-').map(Number);
  const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  const windowStart = new Date(endDate);
  windowStart.setDate(windowStart.getDate() - (days - 1));

  const startKey = toDateKey(windowStart) < monthStartKey ? monthStartKey : toDateKey(windowStart);

  return buildWindow(startKey, endKey, tf);
};

const getWindowFromParams = (monthParam, options = {}) => {
  const opts = typeof options === 'string' ? { timeframe: options } : options || {};
  const startDate = parseDateKey(opts.startDate);
  const endDate = parseDateKey(opts.endDate);

  if (startDate && endDate) {
    let startKey = startDate;
    let endKey = endDate;
    if (startKey > endKey) {
      [startKey, endKey] = [endKey, startKey];
    }
    const clipped = clipKeysToMonth(startKey, endKey, monthParam);
    return buildWindow(clipped.startKey, clipped.endKey, 'custom');
  }

  return getWindowForMonth(monthParam, opts.timeframe);
};

const inWindow = (dateKey, window) => {
  if (!dateKey) return false;
  return dateKey >= window.startKey && dateKey <= window.endKey;
};

const recountAttendance = (byDay) => {
  let present = 0;
  let halfDay = 0;
  let leave = 0;
  let empty = 0;

  byDay.forEach((d) => {
    if (d.status === 'leave') leave += 1;
    else if (d.status === 'halfDay') halfDay += 1;
    else if (d.status === 'present') present += 1;
    else empty += 1;
  });

  return {
    present,
    halfDay,
    leave,
    empty,
    byDay,
    chart: byDay.map((d) => ({
      date: d.date,
      value: d.status === 'present' ? 1 : d.status === 'halfDay' ? 0.5 : 0,
    })),
  };
};

const recountTasksFromActivity = (activity) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    total: activity.length,
    completed: activity.filter((t) => t.status === 'done').length,
    inProgress: activity.filter((t) => t.status === 'in-progress').length,
    todo: activity.filter((t) => t.status === 'todo').length,
    inReview: activity.filter((t) => t.status === 'in-review').length,
    overdue: activity.filter(
      (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < today
    ).length,
    monthActivity: activity,
  };
};

const applyTimeframeFilter = (report, options = '30d') => {
  if (!report?.month) return report;

  const window = getWindowFromParams(report.month, options);
  const byDay = (report.attendance?.byDay || []).filter((d) => inWindow(d.date, window));

  const logsByDay = (report.logs?.byDay || []).filter((d) => inWindow(d.date, window));
  const logEntries = (report.logs?.entries || []).filter((e) => inWindow(e.date, window));
  const totalHours = logsByDay.reduce((s, d) => s + (d.hours || 0), 0);

  const activity = (report.tasks?.monthActivity || []).filter((t) => inWindow(t.date, window));
  const tasks = {
    ...report.tasks,
    ...recountTasksFromActivity(activity),
  };

  const calendarEvents = (report.calendar?.events || []).filter((e) => inWindow(e.date, window));

  return {
    ...report,
    timeframe: window.timeframe,
    window: {
      start: window.startKey,
      end: window.endKey,
      days: window.days,
    },
    period: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    },
    attendance: recountAttendance(byDay),
    tasks,
    logs: {
      ...report.logs,
      totalEntries: logEntries.length,
      totalHours,
      byDay: logsByDay,
      entries: logEntries,
    },
    calendar: {
      total: calendarEvents.length,
      events: calendarEvents,
    },
  };
};

const resolveReportRangeOptions = (query = {}) => {
  const startDate = parseDateKey(query.startDate);
  const endDate = parseDateKey(query.endDate);
  if (startDate && endDate) {
    return { startDate, endDate };
  }
  return { timeframe: resolveTimeframe(query.timeframe) };
};

module.exports = {
  TIMEFRAME_DAYS,
  VALID_TIMEFRAMES,
  resolveTimeframe,
  getMonthBounds,
  getWindowForMonth,
  getWindowFromParams,
  inWindow,
  applyTimeframeFilter,
  resolveReportRangeOptions,
};
