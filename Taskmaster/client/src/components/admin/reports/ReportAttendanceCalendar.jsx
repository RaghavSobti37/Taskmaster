import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, parseISO } from 'date-fns';

const STATUS_COLORS = {
  holiday: 'bg-[var(--color-pastel-violet-bg)] border-[var(--color-pastel-violet-text)]/40',
  leave: 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/40',
  halfDay: 'bg-amber-400/80 border-amber-500/50',
  present: 'bg-emerald-500/90 border-emerald-600/60',
  empty: 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]',
  today: 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-primary)]',
};

const getStatusForDay = (dateKey, byDayMap) => {
  const entry = byDayMap[dateKey];
  if (!entry) return 'empty';
  return entry.status || 'empty';
};

const ReportAttendanceCalendar = ({ byDay = [], month, height = 200 }) => {
  const byDayMap = useMemo(() => {
    const map = {};
    (byDay || []).forEach((d) => {
      if (d.date) map[d.date] = d;
    });
    return map;
  }, [byDay]);

  const weeks = useMemo(() => {
    if (!month) return [];
    const monthDate = typeof month === 'string'
      ? parseISO(month.length === 7 ? month + '-01' : month)
      : month;
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    const result = [];
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7).map((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return {
          date,
          dateKey,
          key: dateKey,
          isCurrentMonth: format(date, 'yyyy-MM') === format(monthDate, 'yyyy-MM'),
          day: format(date, 'd'),
          isToday: dateKey === format(new Date(), 'yyyy-MM-dd'),
          status: getStatusForDay(dateKey, byDayMap),
        };
      });
      result.push(week);
    }
    return result;
  }, [month, byDayMap]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const summary = useMemo(() => {
    let present = 0, halfDay = 0, leave = 0;
    Object.values(byDayMap).forEach((d) => {
      if (d.status === 'present') present++;
      else if (d.status === 'halfDay') halfDay++;
      else if (d.status === 'leave') leave++;
    });
    return { present, halfDay, leave };
  }, [byDayMap]);

  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/90" />
          Present: {summary.present}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/80" />
          Half: {summary.halfDay}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-pastel-rose-bg)] border border-[var(--color-pastel-rose-text)]/40" />
          Leave: {summary.leave}
        </span>
      </div>

      <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
            <tr>
              {weekDays.map((day) => (
                <th
                  key={day}
                  className="py-1.5 px-1 text-center text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] w-[14.28%] border-r last:border-r-0 border-[var(--color-bg-border)]"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, idx) => (
              <tr key={idx} className="border-b last:border-b-0 border-[var(--color-bg-border)]">
                {week.map((dayInfo) => (
                  <td
                    key={dayInfo.key}
                    className={`relative border-r last:border-r-0 border-[var(--color-bg-border)] p-1 align-top transition-colors
                      ${!dayInfo.isCurrentMonth ? 'opacity-30 bg-[var(--color-bg-secondary)]/40' : ''}
                      ${dayInfo.isToday ? 'ring-2 ring-inset ring-[var(--color-action-primary)]' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center gap-1 min-h-[38px]">
                      <span
                        className={`text-[9px] font-bold ${
                          dayInfo.isToday
                            ? 'bg-[var(--color-action-primary)] text-white w-5 h-5 flex items-center justify-center rounded-full'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {dayInfo.day}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-sm border ${
                          STATUS_COLORS[dayInfo.status] || STATUS_COLORS.empty
                        } ${dayInfo.isToday && dayInfo.status !== 'empty' ? STATUS_COLORS.today : ''}`}
                        title={dayInfo.isCurrentMonth ? `${dayInfo.dateKey}: ${dayInfo.status}` : ''}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportAttendanceCalendar;
