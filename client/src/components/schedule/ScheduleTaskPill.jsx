import React from 'react';
import { resolveTaskWorkspaceColor, getTaskRowStyle } from '../../utils/workspaceColors';
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
      style={{
        ...style,
        ...(isDone
          ? { '--workspace-accent': 'var(--color-pastel-slate-text)' }
          : getTaskRowStyle(workspaceColor)),
      }}
      className={`tm-schedule-pill flex ${taskMaxW} text-left rounded-md overflow-hidden transition-all ${
        isDone ? 'tm-schedule-pill--completed' : ''
      }`}
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
        className="min-w-0 flex-1 truncate text-[9px] font-semibold px-1.5 py-1 leading-tight text-[var(--color-text-primary)]"
        truncate
      />
    </button>
  );
};

export default ScheduleTaskPill;
