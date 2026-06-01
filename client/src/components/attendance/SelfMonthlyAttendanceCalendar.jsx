import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button } from '../ui';
import { getHolidayLabel } from '../../utils/officeHolidays';

const SQUARE_COLORS = {
  holiday: 'bg-[var(--color-pastel-violet-bg)] border-[var(--color-pastel-violet-text)]/40',
  leave: 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/40',
  halfDay: 'bg-amber-400/80 border-amber-500/50',
  present: 'bg-emerald-500/90 border-emerald-600/60',
  empty: 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]',
  approved: 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-primary)]',
};

const getSquareColor = (status, entry) => {
  const isFullyApproved = entry?.inTimeRecord?.isApproved && entry?.outTimeRecord?.isApproved;
  if (isFullyApproved && status === 'present') return `${SQUARE_COLORS.present} ${SQUARE_COLORS.approved}`;
  if (isFullyApproved && status === 'halfDay') return `${SQUARE_COLORS.halfDay} ${SQUARE_COLORS.approved}`;
  return SQUARE_COLORS[status] || SQUARE_COLORS.empty;
};

const buildTooltip = (date, entry, status) => {
  const lines = [format(date, 'EEEE, MMM d, yyyy')];
  if (status === 'holiday') {
    lines.push(`Holiday: ${getHolidayLabel(date)}`);
    if (entry?.inTimeRecord?.manualTimestamp || entry?.outTimeRecord?.manualTimestamp) {
      lines.push('Status: Present (worked on holiday)');
    }
    return lines.join('\n');
  }
  if (!entry) {
    lines.push('No input');
    return lines.join('\n');
  }
  if (entry.onLeave || status === 'leave') lines.push('Status: Leave');
  else if (entry.isHalfDay) lines.push('Status: Half Day');
  else if (entry.inTimeRecord?.manualTimestamp || entry.outTimeRecord?.manualTimestamp) lines.push('Status: Present');
  else lines.push('Status: No input');
  
  if (entry.inTimeRecord?.manualTimestamp) lines.push(`In: ${entry.inTimeRecord.manualTimestamp} ${entry.inTimeRecord.isApproved ? '(Approved)' : ''}`);
  if (entry.outTimeRecord?.manualTimestamp) lines.push(`Out: ${entry.outTimeRecord.manualTimestamp} ${entry.outTimeRecord.isApproved ? '(Approved)' : ''}`);
  
  if (entry.reason) lines.push(`Note: ${entry.reason}`);
  return lines.join('\n');
};

const SelfMonthlyAttendanceCalendar = ({
  month,
  onMonthChange,
  rowMap,
  userId,
  resolveStatus,
  title = 'My Monthly Attendance',
}) => {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }); // Start on Monday
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Split days into weeks
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">{title}</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={() => onMonthChange(subMonths(month, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm font-bold min-w-[120px] text-center">{format(month, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="xs" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase text-[var(--color-text-muted)] mb-4">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/90 border border-emerald-600/60" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400/80 border border-amber-500/50" /> Half Day</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--color-pastel-violet-bg)] border border-[var(--color-pastel-violet-text)]/40" /> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--color-pastel-rose-bg)] border border-[var(--color-pastel-rose-text)]/40" /> Leave</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]" /> No input</span>
      </div>

      <div className="rounded-xl border border-[var(--color-bg-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
            <tr>
              {weekDays.map(day => (
                <th key={day} className="py-2 px-2 text-center text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] w-[14.28%] border-r last:border-r-0 border-[var(--color-bg-border)]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, idx) => (
              <tr key={idx} className="border-b last:border-b-0 border-[var(--color-bg-border)]">
                {week.map(date => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const mapKey = `${userId}_${dateKey}`;
                  const entry = rowMap.get(mapKey);
                  const status = resolveStatus(entry, date);
                  const isCurrentMonth = date.getMonth() === month.getMonth();

                  return (
                    <td key={dateKey} className={`relative h-24 border-r last:border-r-0 border-[var(--color-bg-border)] p-2 align-top transition-colors hover:bg-[var(--color-bg-secondary)]/30 ${!isCurrentMonth ? 'opacity-40 bg-[var(--color-bg-secondary)]/50' : ''}`} title={buildTooltip(date, entry, status)}>
                      <div className="flex flex-col items-center justify-center h-full gap-2">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] absolute top-2 left-2">{format(date, 'd')}</span>
                        <div className={`w-8 h-8 rounded-lg border shadow-sm ${getSquareColor(status, entry)}`} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default SelfMonthlyAttendanceCalendar;
