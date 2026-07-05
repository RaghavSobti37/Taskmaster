import React from 'react';
import { UserLabel } from '../ui';

const STATUS_LABELS = {
  todo: 'To do',
  'in-progress': 'In progress',
  'in-review': 'In review',
};

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const ProjectOpenTasksTable = ({ tasks = [] }) => {
  if (!tasks.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] opacity-60">
        No open tasks for this project.
      </p>
    );
  }

  return (
    <table className="w-full table-fixed text-left text-xs border-collapse">
      <colgroup>
        <col className="w-[36%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[12%]" />
        <col className="w-[24%]" />
      </colgroup>
      <thead>
        <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
          <th className="pb-2 pr-3 font-semibold">Task</th>
          <th className="pb-2 pr-3 font-semibold">Status</th>
          <th className="pb-2 pr-3 font-semibold">Priority</th>
          <th className="pb-2 pr-3 text-right font-semibold">Planned h</th>
          <th className="pb-2 font-semibold">Assignees</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task._id} className="border-b border-[var(--color-bg-border)]/50">
            <td className="py-2 pr-3 font-bold truncate" title={task.title}>
              {task.title}
            </td>
            <td className="py-2 pr-3 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              {STATUS_LABELS[task.status] || task.status}
            </td>
            <td className="py-2 pr-3 text-[10px] uppercase tracking-wide">
              {PRIORITY_LABELS[task.priority] || task.priority}
            </td>
            <td className="py-2 pr-3 tabular-nums text-right">
              {task.plannedHours > 0 ? task.plannedHours.toFixed(1) : '—'}
            </td>
            <td className="py-2">
              {task.assignees?.length ? (
                <div className="flex flex-wrap gap-1">
                  {task.assignees.map((a) => (
                    <UserLabel key={a.userId} user={a} size="xs" nameClassName="text-[10px]" />
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-[var(--color-text-muted)]">Unassigned</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ProjectOpenTasksTable;
