import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import { getHolidayLabel } from '../../utils/officeHolidays';
import { inferEditScope } from '../../utils/attendanceUtils';
import { resolveRowEntry } from '../../utils/attendanceRosterVisibility';

const SQUARE_COLORS = {
  holiday: 'bg-[var(--color-pastel-violet-bg)] border-[var(--color-pastel-violet-text)]/40',
  leave: 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/40',
  halfDay: 'bg-amber-400/80 border-amber-500/50',
  present: 'bg-emerald-500/90 border-emerald-600/60',
  empty: 'bg-transparent border-[var(--color-bg-border)]',
  approved: 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-primary)]',
};

const getSquareColor = (status, entry) => {
  const isFullyApproved = entry?.inTimeRecord?.isApproved && entry?.outTimeRecord?.isApproved;
  if (isFullyApproved && status === 'present') return `${SQUARE_COLORS.present} ${SQUARE_COLORS.approved}`;
  if (isFullyApproved && status === 'halfDay') return `${SQUARE_COLORS.halfDay} ${SQUARE_COLORS.approved}`;
  return SQUARE_COLORS[status] || SQUARE_COLORS.empty;
};

const buildTooltip = (date, entry, status) => {
  const lines = [formatWeekdayDateLong(date)];
  if (status === 'holiday') {
    lines.push(`Holiday: ${getHolidayLabel(date)}`);
    if (entry?.inTimeRecord?.timestamp || entry?.outTimeRecord?.timestamp) {
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
  else if (entry.inTimeRecord?.timestamp || entry.outTimeRecord?.timestamp) lines.push('Status: Present');
  else lines.push('Status: No input');
  
  if (entry.inTimeRecord?.timestamp) lines.push(`In: ${entry.inTimeRecord.timestamp} ${entry.inTimeRecord.isApproved ? '(Approved)' : ''}`);
  if (entry.outTimeRecord?.timestamp) lines.push(`Out: ${entry.outTimeRecord.timestamp} ${entry.outTimeRecord.isApproved ? '(Approved)' : ''}`);
  
  if (entry.reason) lines.push(`Note: ${entry.reason}`);
  return lines.join('\n');
};

const MonthlyAttendanceGrid = ({
  month,
  onMonthChange,
  rowMap,
  users = [],
  singleUser = null,
  approvedLeaves = [],
  resolveStatus,
  onEdit,
  title = 'Monthly View',
}) => {
  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const displayUsers = singleUser ? [singleUser] : users;

  return (
    <section className="space-y-4 border-t border-[var(--color-bg-border)] pt-4">
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

      <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-20 bg-[var(--color-bg-secondary)] border-b border-r border-[var(--color-bg-border)] px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] min-w-[120px]"
              >
                User
              </th>
              <th
                colSpan={days.length}
                className="border-b border-[var(--color-bg-border)] px-2 py-2 text-center text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]"
              >
                {format(month, 'MMMM')}
              </th>
            </tr>
            <tr>
              {days.map((date) => (
                <th
                  key={format(date, 'yyyy-MM-dd')}
                  className="border-b border-[var(--color-bg-border)] px-0 py-1.5 text-center text-[10px] font-bold text-[var(--color-text-muted)] w-8 min-w-[2rem]"
                >
                  {format(date, 'd')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayUsers.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="px-4 py-6 text-center text-[var(--color-text-muted)] italic">
                  No users to display
                </td>
              </tr>
            )}
            {displayUsers.map((userRow) => (
              <tr key={userRow._id} className="border-b border-[var(--color-bg-border)] last:border-b-0 hover:bg-[var(--color-bg-secondary)]/40">
                <td className="sticky left-0 z-10 bg-[var(--color-bg-primary)] border-r border-[var(--color-bg-border)] px-3 py-2 font-bold whitespace-nowrap">
                  {userRow.name}
                </td>
                {days.map((date) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const entry = resolveRowEntry(rowMap, userRow._id, date, approvedLeaves);
                  const status = resolveStatus(entry, date);

                  return (
                    <td key={dateKey} className="p-1 text-center align-middle">
                      <button
                        type="button"
                        title={buildTooltip(date, entry, status)}
                        onClick={() => onEdit(userRow, date, entry, inferEditScope(entry))}
                        className={`w-7 h-7 rounded-md border transition-transform hover:scale-110 hover:z-10 mx-auto block ${getSquareColor(status, entry)}`}
                        aria-label={`${userRow.name} — ${formatDisplayDateShort(date)}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MonthlyAttendanceGrid;
