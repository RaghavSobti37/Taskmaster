import React from 'react';
import { Skeleton } from '../ui';

/** Table row skeleton for a task still being created or completed. */
export const TaskTableRowSkeleton = ({ colSpan = 6, className = '' }) => (
  <tr className={`tm-task-row ${className}`} aria-busy="true" aria-label="Task loading">
    <td className="px-4 py-3">
      <Skeleton className="!h-5 !w-5 rounded-full" />
    </td>
    <td className="px-4 py-3" colSpan={colSpan - 1}>
      <div className="space-y-2">
        <Skeleton variant="text" className="!h-4 !w-2/3 max-w-xs" />
        <Skeleton variant="text" className="!h-3 !w-1/4 max-w-[120px]" />
      </div>
    </td>
  </tr>
);

/** Kanban card skeleton for pending create. */
export const TaskKanbanCardSkeleton = () => (
  <div
    className="tm-task-row p-4 rounded-xl border border-[var(--color-bg-border)] space-y-3"
    aria-busy="true"
    aria-label="Task loading"
  >
    <Skeleton className="!h-5 !w-16 rounded-full" />
    <Skeleton variant="text" className="!h-4 !w-full" />
    <Skeleton variant="text" className="!h-3 !w-2/3" />
  </div>
);

export default TaskTableRowSkeleton;
