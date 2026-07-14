import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo } from 'react';
import { addDaysToDateKey } from '../../utils/scheduleTaskDates';

function parseDateKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Full-width schedule horizon control: slider row + one checkpoint per day (1..maxDays).
 * dayCount = N consecutive days starting today; days 1..N are shown as in-range.
 */
export default function ScheduleDayViewControl({
  dayCount,
  onDayCountChange,
  rangeStartKey,
  maxDays = 5,
}) {
  const checkpoints = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => {
      const value = i + 1;
      const dateKey = addDaysToDateKey(rangeStartKey, i);
      const date = parseDateKey(dateKey);
      const dateLabel = date ? formatDisplayDateShort(date) : '';
      const dayName = dateLabel;
      return {
        value,
        dateKey,
        dayName,
        dateLabel,
        title:
          value === 1
            ? `Show today only (${dateLabel})`
            : `Show ${value} days from today through ${dateLabel}`,
      };
    });
  }, [rangeStartKey, maxDays]);

  const dayLabel = dayCount === 1 ? '1 day' : `${dayCount} days`;
  const rangeEndKey = addDaysToDateKey(rangeStartKey, dayCount - 1);
  const rangeHint = useMemo(() => {
    if (!rangeStartKey || !rangeEndKey) return '';
    const start = parseDateKey(rangeStartKey);
    const end = parseDateKey(rangeEndKey);
    if (!start || !end) return '';
    if (rangeStartKey === rangeEndKey) return formatWeekdayDate(start);
    return `${formatWeekdayDate(start)} – ${formatWeekdayDate(end)}`;
  }, [rangeStartKey, rangeEndKey]);

  const columnCenterInset = maxDays > 0 ? `calc(100% / ${maxDays} / 2)` : '0px';
  const fillTrackPercent =
    maxDays <= 1 ? 0 : ((dayCount - 1) / (maxDays - 1)) * 100;

  return (
    <section
      className="w-full rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-4 py-3"
      aria-label="Schedule day range"
    >
      {rangeHint && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] text-center mb-2">
          Showing {dayCount} {dayCount === 1 ? 'day' : 'days'} · {rangeHint}
        </p>
      )}
      <div
        className="grid gap-1 px-1 sm:px-2"
        style={{
          gridTemplateColumns: `repeat(${maxDays}, minmax(0, 1fr))`,
          '--max-days': maxDays,
        }}
      >
        <div className="relative col-span-full mb-2" style={{ gridColumn: '1 / -1' }}>
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-bg-border)]"
            style={{ left: columnCenterInset, right: columnCenterInset }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-action-primary)]/35 transition-all duration-200"
            style={{
              left: columnCenterInset,
              width: `calc((100% - (100% / ${maxDays})) * ${fillTrackPercent / 100})`,
            }}
            aria-hidden
          />

          <input
            type="range"
            min={1}
            max={maxDays}
            step={1}
            value={dayCount}
            onChange={(e) => onDayCountChange(Number(e.target.value))}
            aria-label="Days to show in schedule"
            aria-valuemin={1}
            aria-valuemax={maxDays}
            aria-valuenow={dayCount}
            aria-valuetext={dayLabel}
            className="schedule-day-slider schedule-day-slider--grid relative z-[1] w-full cursor-pointer"
          />
        </div>

        <div
          className="contents"
          role="group"
          aria-label="Day checkpoints"
        >
        {checkpoints.map((cp) => {
          const isInRange = cp.value <= dayCount;
          const isRangeEnd = cp.value === dayCount;
          return (
            <button
              key={cp.value}
              type="button"
              title={cp.title}
              onClick={() => onDayCountChange(cp.value)}
              className={`flex flex-col items-center gap-1 min-w-0 px-0.5 py-1 rounded-[var(--radius-atomic)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] ${
                isInRange
                  ? 'bg-[var(--color-action-primary)]/10'
                  : 'hover:bg-[var(--color-bg-secondary)]'
              }`}
              aria-pressed={isInRange}
              aria-label={cp.title}
            >
              <span
                className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors ${
                  isInRange
                    ? `bg-[var(--color-action-primary)] border-[var(--color-bg-primary)]${
                        isRangeEnd ? ' shadow-[0_0_0_2px_var(--color-action-primary)]' : ''
                      }`
                    : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)]'
                }`}
              />
              <span
                className={`text-[9px] font-black uppercase tracking-wide leading-none ${
                  isInRange ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {cp.value === 1 ? 'Today' : cp.dayName}
              </span>
              <span
                className={`text-[8px] font-bold tabular-nums leading-none ${
                  isInRange ? 'text-[var(--color-action-primary)]/80' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {cp.dateLabel}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}
