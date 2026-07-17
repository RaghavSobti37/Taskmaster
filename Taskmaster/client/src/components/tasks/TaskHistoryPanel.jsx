import React, { useMemo } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useTaskActivity } from '../../hooks/queries/tasks';
import { resolveTaskId } from '../../utils/taskCompletion';
import { filterTaskActivityForDisplay } from '../../utils/taskActivityDisplay';
import TaskActivityTimeline from './TaskActivityTimeline';
import QueryErrorBanner from '../ui/QueryErrorBanner';

function withCreatedFallback(items, task) {
  const filtered = filterTaskActivityForDisplay(items);
  if (filtered.some((item) => item.type === 'created')) return filtered;
  const createdAt = task?.createdAt;
  if (!createdAt) return filtered;
  const creator = task?.createdBy;
  const actor =
    creator && typeof creator === 'object'
      ? { _id: creator._id, name: creator.name, avatar: creator.avatar }
      : null;
  return [
    {
      _id: `local-created-${resolveTaskId(task)}`,
      type: 'created',
      body: '',
      createdAt,
      actor,
    },
    ...filtered,
  ];
}

function CollapsedHistoryRail({ onToggleCollapse }) {
  return (
    <>
      <aside className="flex lg:hidden w-full shrink-0 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-border)]/40 transition-colors"
          aria-label="Expand history panel"
        >
          <PanelRightOpen size={16} aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wider">Show history</span>
        </button>
      </aside>
      <aside className="hidden lg:flex flex-col items-center justify-start shrink-0 w-10 min-h-0 h-full border-l border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mt-3 p-2 rounded-md hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Expand history panel"
          title="Show history"
        >
          <PanelRightOpen size={18} />
        </button>
        <span
          className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] [writing-mode:vertical-rl] rotate-180"
        >
          History
        </span>
      </aside>
    </>
  );
}

export default function TaskHistoryPanel({
  task,
  enabled = true,
  collapsed = false,
  onToggleCollapse,
  onResizeStart,
}) {
  const taskId = resolveTaskId(task);
  const { data: items = [], isLoading, isError, error, refetch } = useTaskActivity(taskId, {
    enabled: enabled && !!taskId,
    markRead: true,
  });
  const visibleItems = useMemo(() => withCreatedFallback(items, task), [items, task]);

  if (collapsed) {
    return <CollapsedHistoryRail onToggleCollapse={onToggleCollapse} />;
  }

  return (
    <aside className="relative flex flex-col min-h-0 h-full bg-[var(--color-bg-workspace)]/50">
      {onResizeStart && (
        <button
          type="button"
          aria-label="Resize history panel"
          onMouseDown={onResizeStart}
          className="hidden lg:block absolute left-0 top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-col-resize z-10 hover:bg-[var(--color-action-primary)]/30 transition-colors"
        />
      )}
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            History
          </h4>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 normal-case font-medium tracking-normal">
            Newest first — creation, assignments, and updates
          </p>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="shrink-0 p-1.5 rounded-md hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Collapse history panel"
            title="Hide history"
          >
            <PanelRightClose size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto tm-modal-scroll p-4">
        {isError ? (
          <QueryErrorBanner
            message={error?.message || 'Could not load history.'}
            onRetry={() => refetch()}
          />
        ) : (
          <TaskActivityTimeline items={visibleItems} isLoading={isLoading} />
        )}
      </div>
    </aside>
  );
}
