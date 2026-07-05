import { format, subDays } from 'date-fns';
import { formatTimeframeLabel } from './displayLabels';

export const getRollingRangeBounds = () => {
  const max = format(new Date(), 'yyyy-MM-dd');
  const min = format(subDays(new Date(), 365), 'yyyy-MM-dd');
  return { min, max, defaultStart: format(subDays(new Date(), 29), 'yyyy-MM-dd'), defaultEnd: max };
};

export const isAllTimeRange = (rangeMode, timeframe) =>
  rangeMode === 'preset' && timeframe === 'all';

export const buildProjectRangeParams = (rangeMode, timeframe, customStart, customEnd) => {
  if (rangeMode === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }
  return { timeframe };
};

export const projectRangeQueryKey = (baseKey, rangeMode, timeframe, customStart, customEnd) => {
  if (rangeMode === 'custom') {
    return [...baseKey, 'custom', customStart, customEnd];
  }
  return [...baseKey, timeframe];
};

export const formatProjectRangeSubtitle = (rangeMode, timeframe, window) => {
  if (!window?.start || !window?.end) return null;
  const dates = `${window.start} → ${window.end}`;
  if (rangeMode === 'custom') return `Custom range · ${dates}`;
  if (timeframe === 'all') return `All time · ${dates}`;
  return `Last ${formatTimeframeLabel(timeframe)} · ${dates}`;
};
