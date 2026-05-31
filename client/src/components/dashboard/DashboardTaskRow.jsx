import React from 'react';
import { Circle } from 'lucide-react';
import { Badge, Skeleton } from '../ui';
import { formatDueDate } from '../../utils/formatDueDate';
import { getTaskRowStyle } from '../../utils/workspaceColors';
import { isTaskOverdue } from '../../utils/dashboardTasks';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { isPendingTask } from '../../utils/pendingTask';

/**
 * Dashboard task row — workspace color bar, title, due label, priority badge.
 * Workspace tint background + coloured left bar.
 */
const DashboardTaskRow = ({
  task,
  workspaceColor,
  onComplete,
  onOpen,
  isCompleting = false,
  className = '',
}) => {
  const dueLabel = formatDueDate(task.dueDate || task.scheduleDate, { emptyLabel: 'No date' });
  const overdue = isTaskOverdue(task);

  if (isCompleting || isPendingTask(task) || task._updating) {
    return (
      <div
        data-highlight-id={task._id}
        className={`tm-task-row flex items-stretch rounded-xl border border-[var(--color-bg-border)] overflow-hidden ${className}`}
        aria-busy="true"
        aria-label="Completing task"
      >
        <Skeleton className="w-1 shrink-0 rounded-l-xl self-stretch min-h-[52px]" />
        <div className="flex-1 p-3 space-y-2">
          <Skeleton variant="text" className="!h-4 !w-3/4" />
          <Skeleton variant="text" className="!h-3 !w-1/3" />
        </div>
        <Skeleton className="w-14 h-6 shrink-0 self-center mr-3 rounded-full" />
      </div>
    );
  }

  return (
    <div
      data-highlight-id={task._id}
      style={getTaskRowStyle(workspaceColor)}
      className={`tm-task-row flex items-stretch rounded-xl border border-[var(--color-bg-border)] ${className}`}
    >
      <div
        className="w-1 shrink-0 rounded-l-xl"
        style={{ backgroundColor: workspaceColor || 'var(--workspace-accent)' }}
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
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
        >
          <p className="tm-task-title truncate flex-1">{task.title}</p>
          
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={getPriorityBadgeVariant(task.priority)} className="uppercase !text-[10px] !font-bold tracking-wide">
              {task.priority || 'medium'}
            </Badge>
            <p className={`text-xs whitespace-nowrap ${overdue ? 'text-[var(--color-pastel-rose-text)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
              {dueLabel}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default DashboardTaskRow;
