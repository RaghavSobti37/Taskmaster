import { formatDisplayDate, formatWeekdayDate } from '../../utils/dateDisplay';
import React, { useMemo, useEffect, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import { normalizeWorkDate } from '../../utils/dailyLogDetails';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getIntensity(count) {
  if (!count) return 0;
  return Math.min(4, Math.ceil(count / 2));
}

export default function DailyLogActivityCalendar({
  activityGrid = [],
  selectedDate,
  onSelectDate,
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate || new Date()));

  useEffect(() => {
    if (selectedDate) setViewMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  const todayKey = useMemo(() => normalizeWorkDate(new Date()), []);
  const activityMap = useMemo(() => {
    const map = new Map();
    for (const entry of activityGrid) {
      if (entry?._id) map.set(entry._id, entry);
    }
    return map;
  }, [activityGrid]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [viewMonth]);

  const handleDayClick = (day) => {
    const key = normalizeWorkDate(day);
    if (key > todayKey) return;
    onSelectDate(new Date(`${key}T12:00:00`));
  };

  return (
    <section className="p-4 border-b border-[var(--color-bg-border)]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="tm-widget-label">Activity</h4>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" title="Previous month" onClick={() => setViewMonth((m) => subMonths(m, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-[10px] font-black uppercase tracking-widest tabular-nums min-w-[7rem] text-center">
            {formatDisplayDate(viewMonth)}
          </span>
          <Button
            variant="ghost"
            size="xs"
            title="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            disabled={format(viewMonth, 'yyyy-MM') >= format(new Date(), 'yyyy-MM')}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="text-center text-[8px] font-bold text-[var(--color-text-muted)] uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateKey = normalizeWorkDate(day);
          const activity = activityMap.get(dateKey);
          const count = activity?.count || 0;
          const intensity = getIntensity(count);
          const isFuture = dateKey > todayKey;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const inMonth = isSameMonth(day, viewMonth);

          return (
            <button
              key={dateKey}
              type="button"
              disabled={isFuture}
              onClick={() => handleDayClick(day)}
              title={isFuture ? undefined : `${formatWeekdayDate(day)}: ${count} logs`}
              className={[
                'aspect-square rounded-sm text-[10px] font-bold tabular-nums transition-all',
                'flex items-center justify-center relative overflow-hidden',
                inMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]/50',
                isFuture ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-blue-400/60',
                isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[var(--color-bg-workspace)]' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={`absolute inset-0 rounded-sm ${intensity === 0 ? 'bg-blue-500/5' : 'bg-blue-500'}`}
                style={intensity > 0 ? { opacity: intensity * 0.25 } : undefined}
              />
              <span className="relative z-10">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-4">
        <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase">Less</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-sm bg-blue-500"
              style={{ opacity: i === 0 ? 0.05 : i * 0.25 }}
            />
          ))}
        </div>
        <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase">More</span>
      </div>
    </section>
  );
}
