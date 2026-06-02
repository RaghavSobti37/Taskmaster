import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Check, ExternalLink } from 'lucide-react';
import { Card, Badge, DataLoading, Button } from '../ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor } from '../../utils/workspaceColors';
import { getTaskAssignee, getTaskAssignedBy, displayPersonName } from '../../utils/taskReview';
import { resolveTaskId } from '../../utils/taskCompletion';
import MentionTitle from '../mentions/MentionTitle';

const ReviewTaskRow = ({
  task,
  projects,
  workspaces,
  onApprove,
  approvingTaskId,
}) => {
  const navigate = useNavigate();
  const taskId = resolveTaskId(task);
  const assignee = getTaskAssignee(task);
  const assigner = getTaskAssignedBy(task);
  const projectId = task.projectId?._id || task.projectId;
  const projectName = task.projectId?.name || projects.find((p) => String(p._id) === String(projectId))?.name;
  const accent = resolveTaskWorkspaceColor(task, workspaces, projects);
  const isApproving = approvingTaskId === taskId;

  return (
    <div
      className="tm-task-row flex items-stretch rounded-xl border border-amber-500/25 bg-amber-500/[0.04] overflow-hidden"
      data-highlight-id={taskId}
    >
      <div className="w-1 shrink-0 rounded-l-xl" style={{ backgroundColor: accent || '#f59e0b' }} aria-hidden />
      <div className="flex-1 min-w-0 p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => projectId && navigate(`/projects/${projectId}`)}
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
              onClick={() => navigate(`/projects/${projectId}`)}
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
          variant="primary"
          size="xs"
          disabled={isApproving}
          onClick={() => onApprove?.(task)}
          className="!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
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
  loading,
  onApprove,
  approvingTaskId = null,
}) => {
  const { data: workspaces = [] } = useWorkspaces();
  return (
  <Card className="p-0 flex flex-col shadow-md overflow-hidden h-full border-[rgba(255,255,255,0.08)]">
    <div className="h-12 px-4 border-b border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-secondary)] flex items-center justify-between gap-2 shrink-0">
      <h4 className="tm-section-label flex items-center gap-2 text-[var(--color-text-primary)] mb-0">
        <ClipboardCheck size={16} className="text-amber-500" />
        Awaiting Your Review
      </h4>
      <Badge variant={tasks.length > 0 ? 'warning' : 'info'}>{tasks.length}</Badge>
    </div>
    <div className={`p-3 flex-1 flex flex-col ${!loading && tasks.length === 0 ? 'items-center justify-center' : 'space-y-2'} ${tasks.length > 4 ? 'max-h-[min(36vh,280px)] overflow-y-auto custom-scrollbar' : ''}`}>
      {loading && <DataLoading message="Loading reviews..." className="!py-3" />}
      {!loading && tasks.length === 0 && (
        <div className="flex items-center justify-center py-4 px-6 bg-emerald-500/10 rounded border border-emerald-500/20">
          <span className="text-emerald-500 font-bold text-xs">All Caught Up!</span>
        </div>
      )}
      {!loading &&
        tasks.map((task) => (
          <ReviewTaskRow
            key={resolveTaskId(task)}
            task={task}
            projects={projects}
            workspaces={workspaces}
            onApprove={onApprove}
            approvingTaskId={approvingTaskId}
          />
        ))}
    </div>
  </Card>
  );
};

export default ReviewQueueCard;
