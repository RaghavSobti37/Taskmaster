import React, { useState } from 'react';
import { Badge, TablePagination } from '../ui';
import { User, Calendar, Circle } from 'lucide-react';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { formatDueDate } from '../../utils/formatDueDate';
import { useProjects, useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor, getTaskRowStyle } from '../../utils/workspaceColors';
import { isPendingTask } from '../../utils/pendingTask';
import MentionTitle from '../mentions/MentionTitle';
import TaskMentionBadge from '../tasks/TaskMentionBadge';
import { TaskTableRowSkeleton } from '../tasks/TaskPendingSkeleton';
import CompletedTaskRollbackButton from '../tasks/CompletedTaskRollbackButton';
import { useAuth } from '../../contexts/AuthContext';

const COMPLETED_PAGE_SIZE_DEFAULT = 10;

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

const TaskStatusSwitcher = ({ task, onUpdate, onCompleteRequest }) => (
  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
    {STATUS_OPTIONS.map((option) => {
      const isActive = task.status === option.value;
      return (
        <button
          key={option.value}
          type="button"
          title={option.label}
          onClick={() => {
            if (option.value === 'done') {
              onCompleteRequest(task);
              return;
            }
            onUpdate(task._id, { status: option.value, progress: progressForStatus(option.value) });
          }}
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

const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-[var(--color-bg-border)]">
      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] w-10" />
      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Task Name</th>
      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Priority</th>
      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Assignee</th>
      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Due Date</th>
    </tr>
  </thead>
);

const ProjectList = ({
  tasks,
  onUpdate,
  onCompleteRequest,
  onDetail,
  completingTaskId = null,
  completedTotal = null,
  completedPage = 1,
  completedPageSize = COMPLETED_PAGE_SIZE_DEFAULT,
  completedTotalPages = 1,
  onCompletedPageChange,
  onCompletedPageSizeChange,
  serverCompletedPagination = false,
}) => {
  const { user } = useAuth();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const [localCompletedPage, setLocalCompletedPage] = useState(1);
  const [localCompletedPageSize, setLocalCompletedPageSize] = useState(COMPLETED_PAGE_SIZE_DEFAULT);

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const useServerPagination = serverCompletedPagination && typeof onCompletedPageChange === 'function';
  const pageSize = useServerPagination ? completedPageSize : localCompletedPageSize;
  const currentPage = useServerPagination ? completedPage : localCompletedPage;
  const totalDoneCount = useServerPagination ? (completedTotal ?? doneTasks.length) : doneTasks.length;
  const totalPages = useServerPagination
    ? completedTotalPages
    : Math.max(1, Math.ceil(doneTasks.length / pageSize));
  const completedStart = (currentPage - 1) * pageSize;
  const paginatedDoneTasks = useServerPagination
    ? doneTasks
    : doneTasks.slice(completedStart, completedStart + pageSize);

  const handlePageChange = (page) => {
    if (useServerPagination) onCompletedPageChange(page);
    else setLocalCompletedPage(page);
  };

  const handlePageSizeChange = (size) => {
    if (useServerPagination && onCompletedPageSizeChange) onCompletedPageSizeChange(size);
    else {
      setLocalCompletedPageSize(size);
      setLocalCompletedPage(1);
    }
  };

  const renderCompletedRow = (task) => (
    <tr
      key={task._id}
      className="tm-task-row tm-task-row--completed border-b border-[var(--color-bg-border)]"
    >
      <td className="px-4 py-1.5 w-10">
        <CompletedTaskRollbackButton task={task} user={user} onClick={onDetail} />
      </td>
      <td colSpan={5} className="px-4 py-1.5">
        <MentionTitle
          text={task.title}
          className="text-sm text-[var(--color-text-muted)] line-through decoration-[var(--color-text-muted)]/50 truncate block"
          truncate
        />
      </td>
    </tr>
  );

  const renderRow = (task) => {
    if (completingTaskId === task._id || isPendingTask(task) || task._updating) {
      return <TaskTableRowSkeleton key={task._id} colSpan={6} className="!border-0" />;
    }

    const isInReview = task.status === 'in-review';

    return (
      <tr
        key={task._id}
        data-highlight-id={task._id}
        onClick={(e) => { if (!e.target.closest('button')) onDetail(task); }}
        className="tm-task-row cursor-pointer transition-colors group border-b border-[var(--color-bg-border)]"
        style={getTaskRowStyle(resolveTaskWorkspaceColor(task, workspaces, projects))}
      >
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isInReview) onCompleteRequest(task);
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] transition-colors"
            aria-label="Mark complete"
          >
            <Circle size={20} />
          </button>
        </td>
        <td className="px-4 py-2 max-w-0 w-full">
          <div className="cursor-pointer min-w-0" onClick={() => onDetail(task)}>
            <div className="text-sm font-bold transition-all min-w-0 flex items-center gap-2 text-[var(--color-text-primary)]">
              <MentionTitle text={task.title} className="tm-task-title" truncate />
              <TaskMentionBadge task={task} />
            </div>
          </div>
        </td>
        <td className="px-4 py-2">
          <TaskStatusSwitcher task={task} onUpdate={onUpdate} onCompleteRequest={onCompleteRequest} />
        </td>
        <td className="px-4 py-2">
          <Badge variant={getPriorityBadgeVariant(task.priority)}>
            {task.priority}
          </Badge>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--color-bg-border)] flex items-center justify-center overflow-hidden border border-[var(--color-bg-border)]">
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
        <td className="px-4 py-2">
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Calendar size={14} />
            <span className="text-xs font-medium tabular-nums">
              {formatDueDate(task.dueDate)}
            </span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
        <table className="w-full text-left border-collapse">
          {TABLE_HEAD}
          <tbody>
            {activeTasks.map((task) => renderRow(task))}
            {activeTasks.length === 0 && doneTasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[var(--color-text-muted)] italic">
                  No tasks found in this project.
                </td>
              </tr>
            )}
            {activeTasks.length === 0 && doneTasks.length > 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--color-text-muted)] italic">
                  No open tasks — all tasks are completed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalDoneCount > 0 && (
        <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
          <div className="px-4 py-2 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Completed Tasks ({totalDoneCount})
            </h3>
          </div>
          <table className="w-full text-left border-collapse">
            <tbody>
              {paginatedDoneTasks.map(renderCompletedRow)}
            </tbody>
          </table>
          <TablePagination
            pageSize={pageSize}
            currentPage={Math.min(currentPage, totalPages)}
            totalPages={totalPages}
            totalItems={totalDoneCount}
            rowCount={paginatedDoneTasks.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
};

export default ProjectList;
