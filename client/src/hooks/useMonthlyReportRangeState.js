import { useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import {
  buildReportRangeParams,
  getMonthRangeBounds,
  reportRangeQueryKey,
  formatReportRangeSubtitle,
} from '../utils/monthlyReportRange';

export { reportRangeQueryKey, buildReportRangeParams, formatReportRangeSubtitle };

export function useMonthlyReportRangeState() {
  const [month, setMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [rangeMode, setRangeMode] = useState('preset');
  const [timeframe, setTimeframe] = useState('30d');
  const bounds = useMemo(() => getMonthRangeBounds(month), [month]);
  const [customStart, setCustomStart] = useState(bounds.defaultStart);
  const [customEnd, setCustomEnd] = useState(bounds.defaultEnd);

  useEffect(() => {
    setCustomStart(bounds.defaultStart);
    setCustomEnd(bounds.defaultEnd);
  }, [bounds.defaultStart, bounds.defaultEnd]);

  const queryParams = useMemo(
    () => buildReportRangeParams(month, rangeMode, timeframe, customStart, customEnd),
    [month, rangeMode, timeframe, customStart, customEnd]
  );

  const queryEnabled =
    rangeMode !== 'custom' || Boolean(customStart && customEnd && customStart <= customEnd);

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  const rangeSubtitle = (report) =>
    formatReportRangeSubtitle(rangeMode, timeframe, report?.window);

  const exportRangeSuffix =
    rangeMode === 'custom' ? `${customStart}_${customEnd}` : timeframe;

  return {
    month,
    setMonth,
    shiftMonth,
    rangeMode,
    setRangeMode,
    timeframe,
    setTimeframe,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    queryParams,
    queryEnabled,
    bounds,
    rangeSubtitle,
    exportRangeSuffix,
  };
}
