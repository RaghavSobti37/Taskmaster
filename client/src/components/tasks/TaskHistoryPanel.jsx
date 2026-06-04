import React, { useMemo } from 'react';
import { useTaskActivity } from '../../hooks/queries/tasks';
import { resolveTaskId } from '../../utils/taskCompletion';
import { filterTaskActivityForDisplay } from '../../utils/taskActivityDisplay';
import TaskActivityTimeline from './TaskActivityTimeline';

export default function TaskHistoryPanel({ task, enabled = true }) {
  const taskId = resolveTaskId(task);
  const { data: items = [], isLoading } = useTaskActivity(taskId, {
    enabled: enabled && !!taskId,
    markRead: true,
  });
  const visibleItems = useMemo(() => filterTaskActivityForDisplay(items), [items]);

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
        <TaskActivityTimeline items={visibleItems} isLoading={isLoading} />
      </div>
    </aside>
  );
}
