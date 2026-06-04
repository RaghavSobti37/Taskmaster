import React from 'react';
import { Circle } from 'lucide-react';
import { Badge, Skeleton } from '../ui';
import { formatDueDate } from '../../utils/formatDueDate';
import { getTaskRowStyle } from '../../utils/workspaceColors';
import { isTaskOverdue } from '../../utils/dashboardTasks';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { isPendingTask } from '../../utils/pendingTask';
import MentionTitle from '../mentions/MentionTitle';
import TaskMentionBadge from '../tasks/TaskMentionBadge';

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
  const dueLabel = formatDueDate(task.dueDate || task.scheduleDate, { emptyLabel: 'No date' });
  const overdue = isTaskOverdue(task);
  const projectId = task.projectId?._id || task.projectId;
  const projectName = task.projectId?.name || projects.find((p) => String(p._id) === String(projectId))?.name;

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
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
        >
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <MentionTitle text={task.title} className="tm-task-title" truncate />
              <TaskMentionBadge task={task} />
            </div>
            {projectName && (
              <p className="tm-caption mt-0.5 truncate text-[var(--color-text-muted)]">{projectName}</p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={getPriorityBadgeVariant(task.priority)} className="uppercase !text-[10px] !font-bold tracking-wide">
              {task.priority || 'medium'}
            </Badge>
            <p className={`text-xs tabular-nums whitespace-nowrap ${overdue ? 'text-[var(--color-pastel-rose-text)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
              {dueLabel}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default DashboardTaskRow;
