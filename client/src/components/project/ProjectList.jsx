import React from 'react';
import { Badge } from '../ui';
import { User, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { formatDueDate } from '../../utils/formatDueDate';
import { useProjects, useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor, getTaskRowStyle, getCompletedTaskRowStyle } from '../../utils/workspaceColors';
import { isPendingTask } from '../../utils/pendingTask';
import MentionTitle from '../mentions/MentionTitle';
import { TaskTableRowSkeleton } from '../tasks/TaskPendingSkeleton';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', letter: 'T' },
  { value: 'in-progress', label: 'In Progress', letter: 'P' },
  { value: 'in-review', label: 'In Review', letter: 'R' },
  { value: 'done', label: 'Done', letter: 'D' },
];

const statusColor = (status, active) => {
  if (!active) return 'bg-transparent border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]';
  switch (status) {
    case 'done': return 'bg-[var(--color-pastel-slate-text)] border-[var(--color-pastel-slate-text)] text-white';
    case 'in-review': return 'bg-purple-500 border-purple-500 text-white';
    case 'in-progress': return 'bg-blue-500 border-blue-500 text-white';
    default: return 'bg-slate-500 border-slate-500 text-white';
  }
};

const progressForStatus = (status) => {
  if (status === 'done') return 100;
  if (status === 'todo') return 0;
  return 50;
};

const TaskStatusSwitcher = ({ task, onUpdate }) => (
  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
    {STATUS_OPTIONS.map((option) => {
      const isActive = task.status === option.value;
      return (
        <button
          key={option.value}
          type="button"
          title={option.label}
          onClick={() => onUpdate(task._id, { status: option.value, progress: progressForStatus(option.value) })}
          className={`rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shrink-0 ${
            isActive ? `px-3 py-1 min-w-[4.5rem] ${statusColor(option.value, true)}` : `w-7 h-7 flex items-center justify-center ${statusColor(option.value, false)}`
          }`}
        >
          {isActive ? option.label : option.letter}
        </button>
      );
    })}
  </div>
);

const ProjectList = ({ tasks, onUpdate, onDetail, completingTaskId = null }) => {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const hasBothSections = activeTasks.length > 0 && doneTasks.length > 0;

  const renderRow = (task) => {
    if (completingTaskId === task._id || isPendingTask(task) || task._updating) {
      return <TaskTableRowSkeleton key={task._id} colSpan={6} className="!border-0" />;
    }

    const isDone = task.status === 'done';

    return (
      <tr
        key={task._id}
        data-highlight-id={task._id}
        onClick={(e) => { if (!e.target.closest('button')) onDetail(task); }}
        className={`tm-task-row cursor-pointer rounded-xl overflow-hidden transition-colors group ${isDone ? 'tm-task-row--completed' : ''}`}
        style={isDone ? getCompletedTaskRowStyle() : getTaskRowStyle(resolveTaskWorkspaceColor(task, workspaces, projects))}
      >
        <td className="px-6 py-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(task._id, { status: isDone ? 'todo' : 'done', progress: isDone ? 0 : 100 });
            }}
            className={`transition-colors ${isDone ? 'text-[var(--color-pastel-slate-text)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)]'}`}
          >
            {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
        </td>
        <td className="px-6 py-4 max-w-0 w-full">
          <div className="cursor-pointer min-w-0" onClick={() => onDetail(task)}>
            <div className={`text-sm font-bold transition-all min-w-0 ${isDone ? 'line-through decoration-2 decoration-[var(--color-pastel-slate-text)]/50 text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
              <MentionTitle text={task.title} className="tm-task-title" truncate />
            </div>
            {isDone && task.completedAt && (
              <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-xs normal-case font-medium tracking-normal italic">
                Completed {format(new Date(task.completedAt), 'MMM d')}
              </p>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <TaskStatusSwitcher task={task} onUpdate={onUpdate} />
        </td>
        <td className="px-6 py-4">
          <Badge variant={isDone ? 'info' : getPriorityBadgeVariant(task.priority)}>
            {task.priority}
          </Badge>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--color-bg-border)] flex items-center justify-center overflow-hidden border border-[var(--color-bg-border)] shadow-sm">
              {task.assignees?.[0]?.avatar ? (
                <img src={task.assignees[0].avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={12} className="text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className="text-[10px] font-black text-[var(--color-text-secondary)] uppercase truncate max-w-[80px]">
              {task.assignees?.[0]?.name || 'UNASSIGNED'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Calendar size={14} />
            <span className="text-xs font-medium">
              {formatDueDate(task.dueDate)}
            </span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] w-10" />
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Priority</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Assignee</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {activeTasks.map(renderRow)}

            {hasBothSections && (
              <tr className="bg-[var(--color-bg-workspace)]/60">
                <td colSpan={6} className="px-6 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Completed ({doneTasks.length})
                </td>
              </tr>
            )}

            {doneTasks.map(renderRow)}

            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-[var(--color-text-muted)] italic">
                  No tasks found in this project.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectList;
