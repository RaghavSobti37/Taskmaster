import React from 'react';
import { Badge, ProgressBar } from '../ui';
import { User, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { useProjects, useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor, getTaskRowStyle, getCompletedTaskRowStyle } from '../../utils/workspaceColors';
import { isPendingTask } from '../../utils/pendingTask';
import MentionTitle from '../mentions/MentionTitle';
import TaskMentionBadge from '../tasks/TaskMentionBadge';
import { TaskKanbanCardSkeleton } from '../tasks/TaskPendingSkeleton';

const progressForStatus = (status) => {
  if (status === 'done') return 100;
  if (status === 'todo') return 0;
  return 50;
};

const KanbanCard = ({ task, onMove, onDetail, workspaces, projects, completingTaskId }) => {
  if (completingTaskId === task._id || isPendingTask(task) || task._updating) {
    return <TaskKanbanCardSkeleton />;
  }

  const statuses = ['todo', 'in-progress', 'in-review', 'done'];
  const currentIndex = statuses.indexOf(task.status);
  const isDone = task.status === 'done';
  const accent = resolveTaskWorkspaceColor(task, workspaces, projects);

  const isInReview = task.status === 'in-review';

  return (
    <div
      className={`tm-task-row p-3 border-b transition-colors group ${
        isInReview
          ? 'border-dashed border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/[0.03]'
          : 'border-[var(--color-bg-border)]'
      } ${isDone ? 'tm-task-row--completed' : 'hover:bg-[var(--color-bg-secondary)]/40'}`}
      style={isDone ? getCompletedTaskRowStyle() : getTaskRowStyle(accent)}
      data-highlight-id={task._id}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant={getPriorityBadgeVariant(task.priority)}>
          {task.priority.toUpperCase()}
        </Badge>
        {!isDone && (
          <div className="flex items-center gap-1">
            {currentIndex > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); onMove(task._id, statuses[currentIndex - 1]); }}
                className="p-1 hover:bg-[var(--color-bg-border)] rounded text-[var(--color-text-muted)]"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {currentIndex < statuses.length - 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); onMove(task._id, statuses[currentIndex + 1]); }}
                className="p-1 hover:bg-[var(--color-bg-border)] rounded text-[var(--color-text-muted)]"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className={`${isDone ? 'cursor-default' : 'cursor-pointer'} mb-3`} onClick={() => !isDone && onDetail(task)}>
        <h4 className={`text-xs font-black mb-1 transition-colors uppercase tracking-tight leading-tight flex items-center gap-2 ${isDone ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)]'}`}>
          <MentionTitle text={task.title} />
          <TaskMentionBadge task={task} />
        </h4>
        {isDone ? (
          <div className="pt-2 border-t border-[var(--color-bg-border)] border-dashed space-y-1">
            <p className="text-[9px] font-black text-[var(--color-pastel-slate-text)] uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 size={10} /> Completed
            </p>
          </div>
        ) : null}
      </div>
      
      {!isDone && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-bg-border)]">
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Clock size={12} />
            <span className="text-[10px] font-bold">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center overflow-hidden">
              {task.assignees?.[0]?.avatar ? (
                <img src={task.assignees[0].avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={12} className="text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase truncate max-w-[60px]">
               {task.assignees?.[0]?.name || 'UNASSIGNED'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectKanban = ({ tasks, onUpdate, onDetail, completingTaskId = null }) => {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const columns = [
    { id: 'todo', label: 'To Do', color: 'bg-gray-500' },
    { id: 'in-progress', label: 'In Progress', color: 'bg-blue-500' },
    { id: 'in-review', label: 'In Review', color: 'bg-orange-500' },
    { id: 'done', label: 'Done', color: 'bg-[var(--color-pastel-slate-text)]' },
  ];

  const handleMove = (taskId, newStatus) => {
    onUpdate(taskId, { status: newStatus, progress: progressForStatus(newStatus) });
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4 h-full scroll-smooth custom-scrollbar">
      {columns.map(column => {
        let columnTasks = tasks.filter(t => t.status === column.id);
        if (column.id === 'done') {
          columnTasks = [...columnTasks].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
        }
        return (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${column.color}`} />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">{column.label}</h3>
                <span className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-workspace)] px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 min-h-[200px] border-t border-[var(--color-bg-border)] overflow-y-auto custom-scrollbar">
              {columnTasks.map(task => (
                <KanbanCard key={task._id} task={task} onMove={handleMove} onDetail={onDetail} workspaces={workspaces} projects={projects} completingTaskId={completingTaskId} />
              ))}
              {columnTasks.length === 0 && (
                <div className="h-32 flex flex-col items-center justify-center border-b border-dashed border-[var(--color-bg-border)]">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">No tasks here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectKanban;
