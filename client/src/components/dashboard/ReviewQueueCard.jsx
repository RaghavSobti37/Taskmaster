import React from 'react';
import { ClipboardCheck, Check, ExternalLink } from 'lucide-react';
import { DashboardWidgetShell, DataLoading, Button, CountBadge } from '../ui';
import { resolveTaskWorkspaceColor, getTaskRowStyle } from '../../utils/workspaceColors';
import { getTaskAssignee, getTaskAssignedBy, displayPersonName } from '../../utils/taskReview';
import { resolveTaskId } from '../../utils/taskCompletion';
import MentionTitle from '../mentions/MentionTitle';

const ReviewTaskRow = ({
  task,
  projects,
  workspaces,
  onApprove,
  approvingTaskId,
  onOpenProject,
}) => {
  const taskId = resolveTaskId(task);
  const assignee = getTaskAssignee(task);
  const assigner = getTaskAssignedBy(task);
  const projectId = task.projectId?._id || task.projectId;
  const projectName = task.projectId?.name || projects.find((p) => String(p._id) === String(projectId))?.name;
  const accent = resolveTaskWorkspaceColor(task, workspaces, projects);
  const isApproving = approvingTaskId === taskId;

  return (
    <div
      className="tm-task-row flex items-stretch overflow-hidden"
      style={getTaskRowStyle(accent)}
      data-highlight-id={taskId}
    >
      <div className="flex-1 min-w-0 p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => projectId && onOpenProject?.(projectId)}
            className="text-left min-w-0 flex-1 hover:text-[var(--color-action-primary)] transition-colors"
          >
            <MentionTitle text={task.title} className="tm-task-title" truncate />
            {projectName && (
              <p className="tm-caption mt-0.5 truncate">{projectName}</p>
            )}
          </button>
          {projectId && (
            <button
              type="button"
              onClick={() => onOpenProject?.(projectId)}
              className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] hover:bg-[var(--color-bg-border)] transition-colors"
              title="Open project"
            >
              <ExternalLink size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
          <span className="text-[var(--color-text-muted)]">
            Assignee: {displayPersonName(assignee, 'Assignee')}
          </span>
          <span className="text-amber-600/80">·</span>
          <span className="text-amber-700 dark:text-amber-400">
            Assigned by: {displayPersonName(assigner, 'Unknown')}
          </span>
        </div>
        <Button
          type="button"
          variant="success"
          size="xs"
          disabled={isApproving}
          onClick={() => onApprove?.(task)}
        >
          <Check size={12} className="mr-1" />
          {isApproving ? 'Approving…' : 'Approve & Close'}
        </Button>
      </div>
    </div>
  );
};

const ReviewQueueCard = ({
  tasks = [],
  projects = [],
  workspaces = [],
  loading,
  onApprove,
  approvingTaskId = null,
  onOpenProject,
}) => {
  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName={`p-0 flex flex-col flex-1 min-h-0 ${!loading && tasks.length === 0 ? 'items-center justify-center' : ''} ${tasks.length > 4 ? 'max-h-[min(36vh,280px)] overflow-y-auto custom-scrollbar' : ''}`}
      title="Awaiting Your Review"
      icon={ClipboardCheck}
      actions={<CountBadge count={tasks.length} size="sm" variant={tasks.length > 0 ? 'warning' : 'info'} />}
    >
      {loading && <DataLoading message="Loading reviews..." className="!py-3 px-3" />}
      {!loading && tasks.length === 0 && (
        <div className="flex items-center justify-center py-4 px-6">
          <span className="text-emerald-500 font-bold text-xs">All Caught Up!</span>
        </div>
      )}
      {!loading &&
        tasks.length > 0 && (
          <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {tasks.map((task) => (
              <ReviewTaskRow
                key={resolveTaskId(task)}
                task={task}
                projects={projects}
                workspaces={workspaces}
                onApprove={onApprove}
                approvingTaskId={approvingTaskId}
                onOpenProject={onOpenProject}
              />
            ))}
          </div>
        )}
    </DashboardWidgetShell>
  );
};

export default ReviewQueueCard;
