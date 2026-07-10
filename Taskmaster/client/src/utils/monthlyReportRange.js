import { format, lastDayOfMonth, parseISO, startOfMonth } from 'date-fns';
import { formatTimeframeLabel } from './displayLabels';

export const getMonthRangeBounds = (month) => {
  const base = parseISO(`${month}-01`);
  const min = format(startOfMonth(base), 'yyyy-MM-dd');
  const monthEnd = format(lastDayOfMonth(base), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const max = today < monthEnd ? today : monthEnd;
  return { min, max, defaultStart: min, defaultEnd: max };
};

export const buildReportRangeParams = (month, rangeMode, timeframe, customStart, customEnd) => {
  const params = { month };
  if (rangeMode === 'custom' && customStart && customEnd) {
    params.startDate = customStart;
    params.endDate = customEnd;
  } else {
    params.timeframe = timeframe;
  }
  return params;
};

export const reportRangeQueryKey = (baseKey, month, rangeMode, timeframe, customStart, customEnd) => {
  if (rangeMode === 'custom') {
    return [...baseKey, month, 'custom', customStart, customEnd];
  }
  return [...baseKey, month, timeframe];
};

export const formatReportRangeSubtitle = (rangeMode, timeframe, window) => {
  if (!window?.start || !window?.end) return null;
  const dates = `${window.start} → ${window.end}`;
  if (rangeMode === 'custom') return `Custom range · ${dates}`;
  return `Last ${formatTimeframeLabel(timeframe)} · ${dates}`;
};
