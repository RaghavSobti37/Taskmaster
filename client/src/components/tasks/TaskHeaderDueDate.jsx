import { formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { Badge } from '../ui';
import { getTodayDateKey } from '../../utils/dateValidation';

const pillClass =
  'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shrink-0 h-[2.375rem]';

function isDueOverdue(dueDate, status) {
  if (!dueDate || status === 'done') return false;
  const d = startOfDay(new Date(dueDate));
  if (Number.isNaN(d.getTime())) return false;
  return isBefore(d, startOfDay(new Date()));
}

export default function TaskHeaderDueDate({
  dueDate = '',
  scheduleDate = '',
  status = 'todo',
  onChange,
  disabled = false,
}) {
  const todayKey = getTodayDateKey();
  const minDate =
    scheduleDate && scheduleDate >= todayKey ? scheduleDate : todayKey;

  const overdue = useMemo(
    () => isDueOverdue(dueDate, status),
    [dueDate, status]
  );

  const displayLabel = useMemo(() => {
    if (!dueDate) return 'Set date';
    const d = new Date(`${dueDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dueDate;
    return formatWeekdayDateLong(d);
  }, [dueDate]);

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
      <label
        className={`${pillClass} max-w-full ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-action-primary)]/40'} ${overdue ? 'border-[var(--color-pastel-rose-text)]/40' : ''}`}
        title={disabled ? 'Due date' : 'Click to change due date'}
      >
        <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
          Due
        </span>
        {dueDate ? (
          <span
            className={`hidden sm:inline text-[9px] font-semibold tabular-nums truncate max-w-[9rem] ${
              overdue
                ? 'text-[var(--color-pastel-rose-text)]'
                : 'text-[var(--color-text-secondary)]'
            }`}
            aria-hidden
          >
            {displayLabel}
          </span>
        ) : null}
        <input
          type="date"
          value={dueDate || ''}
          min={minDate}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`bg-transparent border-0 outline-none text-[10px] font-semibold tabular-nums w-[6.5rem] sm:w-[7.25rem] max-w-[calc(100vw-8rem)] p-0 cursor-pointer disabled:cursor-not-allowed ${
            overdue
              ? 'text-[var(--color-pastel-rose-text)]'
              : 'text-[var(--color-text-primary)]'
          }`}
          aria-label="Due date"
        />
        <span className="sr-only">{displayLabel}</span>
      </label>
      {overdue && (
        <Badge variant="overdue" className="!text-[8px] !font-black uppercase tracking-widest shrink-0">
          Overdue
        </Badge>
      )}
    </div>
  );
}
