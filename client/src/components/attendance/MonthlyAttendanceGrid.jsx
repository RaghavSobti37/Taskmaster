import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button } from '../ui';

const SQUARE_COLORS = {
  leave: 'bg-red-500 border-red-500/60',
  halfDay: 'bg-amber-400 border-amber-500/60',
  present: 'bg-emerald-500 border-emerald-600/60',
  empty: 'bg-transparent border-[var(--color-bg-border)]',
  approved: 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-primary)]',
};

const getSquareColor = (status, entry) => {
  if (entry?.isApproved && status === 'present') return `${SQUARE_COLORS.present} ${SQUARE_COLORS.approved}`;
  if (entry?.isApproved && status === 'halfDay') return `${SQUARE_COLORS.halfDay} ${SQUARE_COLORS.approved}`;
  return SQUARE_COLORS[status] || SQUARE_COLORS.empty;
};

const buildTooltip = (date, entry, status) => {
  const lines = [format(date, 'EEE, MMM d, yyyy')];
  if (!entry) {
    lines.push(status === 'leave' ? 'Leave (weekend)' : 'No input');
    return lines.join('\n');
  }
  if (entry.onLeave || status === 'leave') lines.push('Status: Leave');
  else if (entry.isHalfDay) lines.push('Status: Half Day');
  else if (entry.timeIn || entry.timeOut) lines.push('Status: Present');
  else lines.push('Status: No input');
  if (entry.timeIn) lines.push(`In: ${entry.timeIn}`);
  if (entry.timeOut) lines.push(`Out: ${entry.timeOut}`);
  if (entry.reason) lines.push(`Note: ${entry.reason}`);
  if (entry.isApproved) lines.push('Approved & locked');
  return lines.join('\n');
};

const MonthlyAttendanceGrid = ({
  month,
  onMonthChange,
  rowMap,
  users = [],
  singleUser = null,
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

      <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Half Day</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> Absent / Leave</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-[var(--color-bg-border)]" /> No input</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-bg-border)]">
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
                  const mapKey = `${String(userRow._id)}_${dateKey}`;
                  const entry = rowMap.get(mapKey);
                  const status = resolveStatus(entry, date);

                  return (
                    <td key={dateKey} className="p-1 text-center align-middle">
                      <button
                        type="button"
                        title={buildTooltip(date, entry, status)}
                        onClick={() => onEdit(userRow, date, entry)}
                        className={`w-7 h-7 rounded-md border transition-transform hover:scale-110 hover:z-10 mx-auto block ${getSquareColor(status, entry)}`}
                        aria-label={`${userRow.name} — ${format(date, 'MMM d')}`}
                      />
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

export default MonthlyAttendanceGrid;
