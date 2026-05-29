import React from 'react';
import { Circle } from 'lucide-react';
import { Badge } from '../ui';
import { formatDueDate } from '../../utils/formatDueDate';

const priorityVariant = (priority) => {
  const p = String(priority || 'medium').toLowerCase();
  if (p === 'critical' || p === 'high') return 'danger';
  if (p === 'medium') return 'info';
  if (p === 'low') return 'low';
  return 'info';
};

/**
 * Dashboard task row — workspace color bar, title, due label, priority badge.
 * Default: no fill highlight. Hover: subtle surface lift.
 */
const DashboardTaskRow = ({
  task,
  workspaceColor,
  onComplete,
  onOpen,
  className = '',
}) => {
  const dueLabel = formatDueDate(task.dueDate || task.scheduleDate, { emptyLabel: 'No date' });

  return (
    <div
      data-highlight-id={task._id}
      className={`flex items-stretch rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-border)] ${className}`}
    >
      <div
        className="w-1 shrink-0 rounded-l-xl"
        style={{ backgroundColor: workspaceColor }}
        aria-hidden
      />
      <div className="flex items-center gap-2.5 flex-1 min-w-0 py-2.5 pr-3 pl-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.(task);
          }}
          className="text-[var(--color-text-muted)] hover:text-emerald-500 shrink-0 transition-colors"
          aria-label="Complete task"
        >
          <Circle size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => onOpen?.(task)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="tm-task-title truncate">{task.title}</p>
          <p className="tm-caption mt-0.5">{dueLabel}</p>
        </button>
        <Badge variant={priorityVariant(task.priority)} className="shrink-0 uppercase !text-[10px] !font-bold tracking-wide">
          {task.priority || 'medium'}
        </Badge>
      </div>
    </div>
  );
};

export default DashboardTaskRow;
