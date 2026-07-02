import React from 'react';
import { ClipboardCheck, Check, ExternalLink, RotateCcw } from 'lucide-react';
import { DashboardWidgetShell, Button, CountBadge, Skeleton } from '../ui';
import { resolveTaskWorkspaceColor, getTaskRowStyle } from '../../utils/workspaceColors';
import { getTaskAssignee, getTaskAssignedBy, displayPersonName } from '../../utils/taskReview';
import { resolveTaskId } from '../../utils/taskCompletion';
import MentionTitle from '../mentions/MentionTitle';

const ReviewTaskRow = ({
  task,
  projects,
  workspaces,
  onApprove,
  onRollback,
  approvingTaskId,
  rollingBackTaskId,
  onOpenProject,
}) => {
  const taskId = resolveTaskId(task);
  const assignee = getTaskAssignee(task);
  const assigner = getTaskAssignedBy(task);
  const projectId = task.projectId?._id || task.projectId;
  const projectName = task.projectId?.name || projects.find((p) => String(p._id) === String(projectId))?.name;
  const accent = resolveTaskWorkspaceColor(task, workspaces, projects);
  const isApproving = approvingTaskId === taskId;
  const isRollingBack = rollingBackTaskId === taskId;
  const isBusy = isApproving || isRollingBack;

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="success"
            size="xs"
            disabled={isBusy}
            onClick={() => onApprove?.(task)}
          >
            <Check size={12} className="mr-1" />
            {isApproving ? 'Approving…' : 'Approve & Close'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={isBusy}
            onClick={() => onRollback?.(task)}
          >
            <RotateCcw size={12} className="mr-1" />
            {isRollingBack ? 'Rolling back…' : 'Rollback'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const REVIEW_BODY_MIN = 'min-h-[156px]';

const ReviewQueuePlaceholder = () => (
  <div className={`divide-y divide-[var(--color-bg-border)] ${REVIEW_BODY_MIN}`}>
    {[1, 2, 3].map((j) => (
      <div key={j} className="flex gap-3 items-center py-2 px-4">
        <Skeleton variant="circle" width="24px" height="24px" />
        <div className="space-y-1 flex-1">
          <Skeleton width="70%" height="12px" />
          <Skeleton width="40%" height="8px" />
        </div>
        <Skeleton width="48px" height="12px" />
      </div>
    ))}
  </div>
);

const ReviewQueueCard = ({
  tasks = [],
  projects = [],
  workspaces = [],
  loading,
  onApprove,
  onRollback,
  approvingTaskId = null,
  rollingBackTaskId = null,
  onOpenProject,
}) => {
  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName={`p-0 flex flex-col flex-1 min-h-0 ${REVIEW_BODY_MIN} ${tasks.length > 4 ? 'max-h-[min(36vh,280px)] overflow-y-auto custom-scrollbar' : ''}`}
      title="Awaiting Your Review"
      icon={ClipboardCheck}
      actions={<CountBadge count={tasks.length} size="sm" variant={tasks.length > 0 ? 'warning' : 'info'} />}
    >
      {loading && <ReviewQueuePlaceholder />}
      {!loading && tasks.length === 0 && (
        <div className={`flex items-center justify-center ${REVIEW_BODY_MIN} px-6`}>
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
                onRollback={onRollback}
                approvingTaskId={approvingTaskId}
                rollingBackTaskId={rollingBackTaskId}
                onOpenProject={onOpenProject}
              />
            ))}
          </div>
        )}
    </DashboardWidgetShell>
  );
};

export default ReviewQueueCard;
