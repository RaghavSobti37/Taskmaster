import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

export const TIME_RANGE_PRESETS = {
  today: 'today',
  last7: 'last7',
  last30: 'last30',
  last90: 'last90',
  thisMonth: 'thisMonth',
  lastMonth: 'lastMonth',
  custom: 'custom',
};

const PRESET_LABELS = {
  [TIME_RANGE_PRESETS.today]: 'Today',
  [TIME_RANGE_PRESETS.last7]: 'Last 7 days',
  [TIME_RANGE_PRESETS.last30]: 'Last 30 days',
  [TIME_RANGE_PRESETS.last90]: 'Last 90 days',
  [TIME_RANGE_PRESETS.thisMonth]: 'This month',
  [TIME_RANGE_PRESETS.lastMonth]: 'Last month',
  [TIME_RANGE_PRESETS.custom]: 'Custom',
};

/** @returns {{ start: Date, end: Date, preset: string, label: string }} */
export function computeRange(preset, customStart, customEnd) {
  const now = new Date();
  const todayEnd = endOfDay(now);

  switch (preset) {
    case TIME_RANGE_PRESETS.today:
      return {
        preset,
        label: PRESET_LABELS[preset],
        start: startOfDay(now),
        end: todayEnd,
      };
    case TIME_RANGE_PRESETS.last7:
      return {
        preset,
        label: PRESET_LABELS[preset],
        start: startOfDay(subDays(now, 6)),
        end: todayEnd,
      };
    case TIME_RANGE_PRESETS.last30:
      return {
        preset,
        label: PRESET_LABELS[preset],
        start: startOfDay(subDays(now, 29)),
        end: todayEnd,
      };
    case TIME_RANGE_PRESETS.last90:
      return {
        preset,
        label: PRESET_LABELS[preset],
        start: startOfDay(subDays(now, 89)),
        end: todayEnd,
      };
    case TIME_RANGE_PRESETS.thisMonth:
      return {
        preset,
        label: PRESET_LABELS[preset],
        start: startOfMonth(now),
        end: todayEnd,
      };
    case TIME_RANGE_PRESETS.lastMonth: {
      const prev = subMonths(now, 1);
      return {
        preset,
        label: PRESET_LABELS[preset],
        start: startOfMonth(prev),
        end: endOfMonth(prev),
      };
    }
    case TIME_RANGE_PRESETS.custom: {
      const start = customStart ? startOfDay(new Date(customStart)) : startOfDay(now);
      const end = customEnd ? endOfDay(new Date(customEnd)) : todayEnd;
      const label =
        customStart && customEnd
          ? `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
          : PRESET_LABELS.custom;
      return { preset, label, start, end };
    }
    default:
      return computeRange(TIME_RANGE_PRESETS.last7);
  }
}

/** Same-duration window immediately before `range`. */
export function computePreviousRange(range) {
  const durationMs = range.end.getTime() - range.start.getTime();
  const previousEnd = new Date(range.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return {
    start: previousStart,
    end: previousEnd,
    label: 'Previous period',
  };
}

const TimeRangeContext = createContext(null);

export function TimeRangeProvider({ initialPreset = TIME_RANGE_PRESETS.last7, children }) {
  const [preset, setPreset] = useState(initialPreset);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(
    () => computeRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const previousRange = useMemo(() => computePreviousRange(range), [range]);

  const setCustomRange = useCallback((start, end) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPreset(TIME_RANGE_PRESETS.custom);
  }, []);

  const value = useMemo(
    () => ({
      preset,
      setPreset,
      customStart,
      customEnd,
      setCustomStart,
      setCustomEnd,
      setCustomRange,
      range,
      previousRange,
    }),
    [preset, customStart, customEnd, setCustomRange, range, previousRange]
  );

  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) {
    throw new Error('useTimeRange must be used within TimeRangeProvider');
  }
  return ctx;
}

export function TimeRangePicker({ className = '' }) {
  const { preset, setPreset, range } = useTimeRange();

  const options = [
    TIME_RANGE_PRESETS.today,
    TIME_RANGE_PRESETS.last7,
    TIME_RANGE_PRESETS.last30,
    TIME_RANGE_PRESETS.last90,
    TIME_RANGE_PRESETS.thisMonth,
    TIME_RANGE_PRESETS.lastMonth,
  ];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="tm-toolbar-control inline-flex items-center bg-[var(--color-bg-secondary)] rounded-[var(--radius-atomic)] px-1 border border-[var(--color-bg-border)] shrink-0 flex-wrap">
        {options.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            className={`px-2.5 h-7 text-[10px] font-bold rounded-[var(--radius-atomic)] transition-colors ${
              preset === key
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {range.label}
      </span>
    </div>
  );
}
