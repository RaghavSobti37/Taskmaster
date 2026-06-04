import React from 'react';
import { format } from 'date-fns';
import { Check, Lock } from 'lucide-react';
import { UserLabel, Spinner } from '../ui';
import {
  shouldUseSplitLayout,
  getMergedCellLabel,
} from '../../utils/attendanceUtils';

const PASTEL_ROSE_CELL = 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/20';
const PASTEL_VIOLET_CELL = 'bg-[var(--color-pastel-violet-bg)] border-[var(--color-pastel-violet-text)]/20';
const APPROVED_CELL = 'bg-blue-500/10 border-blue-500/30';

const getCellButtonClass = (status, entry, approved = false) => {
  if (approved) return APPROVED_CELL;
  return status === 'holiday' ? PASTEL_VIOLET_CELL :
    status === 'leave' ? PASTEL_ROSE_CELL :
    status === 'halfDay' ? 'bg-amber-500/10 border-amber-500/30' :
    status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
    'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]';
};

const TimeCellButton = ({ label, time, approved, hasTime, status, entry, statusDot, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 min-w-0 rounded-lg border px-3 py-2.5 text-left transition-colors active:ring-2 active:ring-[var(--color-action-primary)]/30 ${getCellButtonClass(status, entry, approved)} ${className}`}
  >
    <div className="text-[9px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</div>
    <div className="flex items-center gap-2 min-w-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
      <span className="text-xs font-bold truncate">{time || '--'}</span>
      {hasTime && !approved && <Check size={12} className="text-emerald-500 shrink-0" />}
      {approved && <Lock size={12} className="text-blue-500 shrink-0" />}
    </div>
  </button>
);

const DayBlock = ({ userRow, date, dayLabel, entry, status, onEdit, statusDot }) => {
  const split = shouldUseSplitLayout(entry, status);
  const defaultScope = !entry?.inTimeRecord?.manualTimestamp ? 'in' : !entry?.outTimeRecord?.manualTimestamp ? 'out' : 'in';

  if (!split) {
    const fullyApproved = entry?.inTimeRecord?.isApproved && entry?.outTimeRecord?.isApproved;
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
          {dayLabel}
          <span className="font-bold normal-case tracking-normal text-[var(--color-text-primary)] ml-1.5">
            {format(date, 'EEE, MMM d')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onEdit(userRow, date, entry, defaultScope)}
          className={`w-full rounded-lg border px-3 py-3 flex items-center justify-center gap-2 min-h-[44px] ${getCellButtonClass(status, entry, fullyApproved)}`}
        >
          {fullyApproved && <Lock size={12} className="text-blue-500 shrink-0" />}
          <span className="text-xs font-bold">{getMergedCellLabel(status, date)}</span>
        </button>
      </div>
    );
  }

  const inAppr = !!entry?.inTimeRecord?.isApproved;
  const outAppr = !!entry?.outTimeRecord?.isApproved;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
        {dayLabel}
        <span className="font-bold normal-case tracking-normal text-[var(--color-text-primary)] ml-1.5">
          {format(date, 'EEE, MMM d')}
        </span>
      </div>
      <div className="flex gap-2">
        <TimeCellButton
          label="In"
          time={entry?.inTimeRecord?.manualTimestamp}
          approved={inAppr}
          hasTime={!!entry?.inTimeRecord?.manualTimestamp}
          status={status}
          entry={entry}
          statusDot={statusDot}
          onClick={() => onEdit(userRow, date, entry, 'in')}
        />
        <TimeCellButton
          label="Out"
          time={entry?.outTimeRecord?.manualTimestamp}
          approved={outAppr}
          hasTime={!!entry?.outTimeRecord?.manualTimestamp}
          status={status}
          entry={entry}
          statusDot={statusDot}
          onClick={() => onEdit(userRow, date, entry, 'out')}
        />
      </div>
    </div>
  );
};

/**
 * Card-based team attendance for viewports below lg (team matrix table is desktop-only layout).
 */
const TeamAttendanceMobileList = ({
  users = [],
  dateColumns = [],
  rowMap,
  resolveStatus,
  onEdit,
  statusDot,
  isLoading,
  usersLoading,
}) => {
  if (isLoading || usersLoading) {
    return (
      <div className="lg:hidden py-6 flex justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="lg:hidden text-sm text-center italic text-[var(--color-text-muted)] py-6">
        No team members to display
      </p>
    );
  }

  return (
    <div className="lg:hidden space-y-3">
      {users.map((userRow) => (
        <article
          key={userRow._id}
          className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
            <UserLabel user={userRow} size="sm" nameClassName="font-bold text-sm" />
          </div>
          <div className="p-3 space-y-4">
            {dateColumns.map(({ date, key: dayKey, label: dayLabel }) => {
              const key = `${String(userRow._id)}_${format(date, 'yyyy-MM-dd')}`;
              const entry = rowMap.get(key);
              const status = resolveStatus(entry, date);
              return (
                <DayBlock
                  key={`${userRow._id}-${dayKey}`}
                  userRow={userRow}
                  date={date}
                  dayLabel={dayLabel}
                  entry={entry}
                  status={status}
                  onEdit={onEdit}
                  statusDot={statusDot}
                />
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
};

export default TeamAttendanceMobileList;
