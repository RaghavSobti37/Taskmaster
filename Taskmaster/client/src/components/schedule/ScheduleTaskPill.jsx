import React from 'react';
import { resolveTaskWorkspaceColor, getTaskRowStyle } from '../../utils/workspaceColors';
import MentionTitle from '../mentions/MentionTitle';
import { UserAvatar } from '../ui/UserAvatar';

const ScheduleTaskPill = ({
  task,
  workspaces,
  projects,
  compact,
  onTaskClick,
  style,
  className = '',
  coAssignees = [],
}) => {
  const isDone = task.status === 'done';
  const workspaceColor = resolveTaskWorkspaceColor(task, workspaces, projects);
  const taskMaxW = compact ? 'max-w-none w-full' : 'w-full max-w-none';

  return (
    <button
      type="button"
      onClick={() => onTaskClick?.(task)}
      title={task.title}
      style={{
        ...style,
        ...(isDone
          ? { '--workspace-accent': 'var(--color-pastel-slate-text)' }
          : getTaskRowStyle(workspaceColor)),
      }}
      className={`tm-schedule-pill flex ${taskMaxW} text-left rounded-md overflow-hidden transition-all ${
        isDone ? 'tm-schedule-pill--completed' : ''
      } ${className}`}
    >
      <div
        className="w-1 shrink-0 self-stretch"
        style={{
          backgroundColor: isDone ? 'var(--color-pastel-slate-text)' : workspaceColor,
        }}
        aria-hidden
      />
      <MentionTitle
        text={task.title}
        className="min-w-0 flex-1 truncate text-[9px] font-semibold leading-tight text-[var(--color-text-primary)] px-1.5 py-1"
        truncate
      />
      {coAssignees.length > 0 && (
        <div
          className="flex items-center shrink-0 pr-1 gap-0.5"
          aria-label={`Also assigned: ${coAssignees.map((m) => m.name).join(', ')}`}
        >
          {coAssignees.slice(0, 3).map((member) => (
            <UserAvatar key={member._id?.toString()} user={member} size="xs" />
          ))}
          {coAssignees.length > 3 && (
            <span className="text-[8px] font-bold text-[var(--color-text-muted)]">+{coAssignees.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
};

export default ScheduleTaskPill;
