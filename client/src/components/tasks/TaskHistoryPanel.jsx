import React, { useMemo } from 'react';
import { useTaskActivity } from '../../hooks/queries/tasks';
import { resolveTaskId } from '../../utils/taskCompletion';
import { filterTaskActivityForDisplay } from '../../utils/taskActivityDisplay';
import TaskActivityTimeline from './TaskActivityTimeline';

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

export default function TaskHistoryPanel({ task, enabled = true }) {
  const taskId = resolveTaskId(task);
  const { data: items = [], isLoading, isError } = useTaskActivity(taskId, {
    enabled: enabled && !!taskId,
    markRead: true,
  });
  const visibleItems = useMemo(() => withCreatedFallback(items, task), [items, task]);

  return (
    <aside className="flex flex-col min-h-0 h-full bg-[var(--color-bg-workspace)]/50">
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          History
        </h4>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 normal-case font-medium tracking-normal">
          Newest first — creation, assignments, and messages
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto tm-modal-scroll p-4">
        {isError ? (
          <p className="text-xs text-red-500 py-4 text-center">Could not load history.</p>
        ) : (
          <TaskActivityTimeline items={visibleItems} isLoading={isLoading} />
        )}
      </div>
    </aside>
  );
}
