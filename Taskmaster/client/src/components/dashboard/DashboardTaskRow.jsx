import React from 'react';
import { Circle } from 'lucide-react';
import { Badge, Skeleton } from '../ui';
import { formatDisplayDateShort } from '../../utils/dateDisplay';
import { getTaskRowStyle } from '../../utils/workspaceColors';
import { isTaskOverdue } from '../../utils/dashboardTasks';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { isPendingTask } from '../../utils/pendingTask';
import MentionTitle from '../mentions/MentionTitle';

const PRIORITY_SHORT = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  urgent: 'Urg',
};

/**
 * Dashboard task row — flat strip with project accent bar (tm-task-row).
 */
const DashboardTaskRow = ({
  task,
  projects = [],
  workspaceColor,
  onComplete,
  onOpen,
  isCompleting = false,
  className = '',
}) => {
  const overdue = isTaskOverdue(task);
  const dueDate = task.dueDate || task.scheduleDate;
  const dueLabel = formatDisplayDateShort(dueDate, { emptyLabel: 'No date' });
  const priorityKey = String(task.priority || 'medium').toLowerCase();
  const priorityLabel = PRIORITY_SHORT[priorityKey] || priorityKey.slice(0, 3);

  if (isCompleting || isPendingTask(task) || task._updating) {
    return (
      <div
        data-highlight-id={task._id}
        className={`tm-task-row flex items-stretch ${className}`}
        style={getTaskRowStyle(workspaceColor)}
        aria-busy="true"
        aria-label="Completing task"
      >
        <div className="flex-1 p-3 space-y-2">
          <Skeleton variant="text" className="!h-4 !w-3/4" />
          <Skeleton variant="text" className="!h-3 !w-1/3" />
        </div>
        <Skeleton className="w-14 h-6 shrink-0 self-center mr-3 rounded-[var(--radius-atomic)]" />
      </div>
    );
  }

  return (
    <div
      data-highlight-id={task._id}
      style={getTaskRowStyle(workspaceColor)}
      className={`tm-task-row flex items-stretch ${className}`}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0 py-2 pr-3 pl-2">
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
          className="flex-1 flex items-center gap-2 min-w-0 text-left"
        >
          <MentionTitle text={task.title} className="tm-task-title flex-1 min-w-0" truncate />
          <Badge
            variant={getPriorityBadgeVariant(task.priority)}
            className="shrink-0 !text-[10px] !font-bold tracking-wide !px-1.5"
          >
            {priorityLabel}
          </Badge>
          <p
            className={`text-xs tabular-nums whitespace-nowrap shrink-0 ${overdue ? 'text-[var(--color-pastel-rose-text)] font-bold' : 'text-[var(--color-text-muted)]'}`}
          >
            {dueLabel}
          </p>
        </button>
      </div>
    </div>
  );
};

export default DashboardTaskRow;
