import React from 'react';
import { resolveTaskWorkspaceColor, getTaskRowStyle, getCompletedTaskRowStyle } from '../../utils/workspaceColors';
import MentionTitle from '../mentions/MentionTitle';

const ScheduleTaskPill = ({ task, workspaces, projects, compact, onTaskClick, style }) => {
  const isDone = task.status === 'done';
  const workspaceColor = resolveTaskWorkspaceColor(task, workspaces, projects);
  const taskMaxW = compact ? 'max-w-none w-full' : 'w-full max-w-none';

  return (
    <button
      type="button"
      onClick={() => onTaskClick?.(task)}
      title={task.title}
      style={{ ...style, ...(isDone ? getCompletedTaskRowStyle(4) : getTaskRowStyle(workspaceColor, 4)) }}
      className={`tm-task-row flex ${taskMaxW} text-left rounded border border-[var(--color-bg-border)] overflow-hidden hover:border-[var(--color-brand-teal)]/50 transition-colors ${
        isDone ? 'tm-task-row--completed' : ''
      }`}
    >
      <div
        className="w-0.5 shrink-0 self-stretch"
        style={{
          backgroundColor: isDone ? 'var(--color-pastel-slate-text)' : workspaceColor,
        }}
        aria-hidden
      />
      <MentionTitle
        text={task.title}
        className="min-w-0 flex-1 truncate text-[9px] font-semibold px-1 py-0.5 leading-tight"
        truncate
      />
    </button>
  );
};

export default ScheduleTaskPill;
