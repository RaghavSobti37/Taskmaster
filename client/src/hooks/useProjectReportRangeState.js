import { useEffect, useMemo, useState } from 'react';
import {
  buildProjectRangeParams,
  formatProjectRangeSubtitle,
  getRollingRangeBounds,
  isAllTimeRange,
} from '../utils/projectReportRange';


export function useProjectReportRangeState() {
  const [rangeMode, setRangeMode] = useState('preset');
  const [timeframe, setTimeframe] = useState('all');
  const bounds = useMemo(() => getRollingRangeBounds(), []);
  const [customStart, setCustomStart] = useState(bounds.defaultStart);
  const [customEnd, setCustomEnd] = useState(bounds.defaultEnd);

  useEffect(() => {
    setCustomStart(bounds.defaultStart);
    setCustomEnd(bounds.defaultEnd);
  }, [bounds.defaultStart, bounds.defaultEnd]);

  const queryParams = useMemo(
    () => buildProjectRangeParams(rangeMode, timeframe, customStart, customEnd),
    [rangeMode, timeframe, customStart, customEnd]
  );

  const queryEnabled =
    rangeMode !== 'custom' || Boolean(customStart && customEnd && customStart <= customEnd);

  const rangeSubtitle = (report) =>
    formatProjectRangeSubtitle(rangeMode, timeframe, report?.window);

  const exportRangeSuffix =
    rangeMode === 'custom' ? `${customStart}_${customEnd}` : timeframe;

  return {
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
    isAllTime: isAllTimeRange(rangeMode, timeframe),
  };
}
