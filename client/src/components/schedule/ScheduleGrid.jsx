import React from 'react';
import { format, addDays } from 'date-fns';
import { Badge, Card } from '../../components/ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { useProjects } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor, getTaskRowStyle, getCompletedTaskRowStyle } from '../../utils/workspaceColors';

const SLOT_LABELS = { AM: 'AM', PM: 'PM', FULL: 'Full Day' };

const ScheduleGrid = ({ data, projectId, onTaskClick, compact = false }) => {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  if (!data) return null;

  const todayKey = data.start;
  const tomorrowKey = data.end;

  const getTasksForUserSlot = (userId, dateKey, slot) => {
    return (data.tasks || []).filter((task) => {
      const sched = task.scheduleDate || task.startDate || task.dueDate;
      if (!sched) return false;
      const key = format(new Date(sched), 'yyyy-MM-dd');
      if (key !== dateKey) return false;
      const taskSlot = task.scheduleSlot || 'FULL';
      const assigned = task.assignments?.some((a) => (a.userId?._id || a.userId)?.toString() === userId);
      if (!assigned) return false;
      if (slot === 'AM') return taskSlot === 'AM' || taskSlot === 'FULL';
      if (slot === 'PM') return taskSlot === 'PM' || taskSlot === 'FULL';
      return true;
    });
  };

  const columns = [
    { key: todayKey, label: 'Today', sub: format(new Date(todayKey), 'EEE, MMM d') },
    { key: tomorrowKey, label: 'Tomorrow', sub: format(new Date(tomorrowKey), 'EEE, MMM d') },
  ];

  return (
    <div className="space-y-6">
      {data.departments?.map((group) => (
        <Card key={group.department?._id || group.department?.slug} className="overflow-hidden">
          <div
            className="px-4 py-3 border-b border-[var(--color-bg-border)] flex items-center gap-2"
            style={{ borderLeftWidth: 4, borderLeftColor: group.department?.color || '#6b7280' }}
          >
            <span className="text-xs font-black uppercase tracking-widest">{group.department?.name || 'Unassigned'}</span>
            <Badge variant="todo">{group.users?.length || 0} members</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] w-40">Member</th>
                  {columns.map((col) => (
                    <th key={col.key} colSpan={2} className="text-center px-2 py-2 border-l border-[var(--color-bg-border)]">
                      <div className="text-[10px] font-black uppercase tracking-widest">{col.label}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{col.sub}</div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
                  <th />
                  {columns.map((col) => (
                    <React.Fragment key={`${col.key}-slots`}>
                      <th className="text-center px-2 py-1 text-[9px] font-bold uppercase text-[var(--color-text-muted)] border-l border-[var(--color-bg-border)]">AM · before 2pm</th>
                      <th className="text-center px-2 py-1 text-[9px] font-bold uppercase text-[var(--color-text-muted)]">PM · after 2pm</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.users?.map((member) => {
                  const uid = member._id?.toString();
                  const wl = member.workload || {};
                  return (
                    <tr key={uid} className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/30">
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-sm">{member.name}</div>
                        {!compact && (
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                            {columns.reduce((sum, c) => sum + (wl[c.key]?.totalTasks || 0), 0)} tasks
                          </div>
                        )}
                      </td>
                      {columns.map((col) => (
                        <React.Fragment key={`${uid}-${col.key}`}>
                          {['AM', 'PM'].map((slot) => {
                            const items = getTasksForUserSlot(uid, col.key, slot);
                            const count = wl[col.key]?.[slot === 'AM' ? 'amCount' : 'pmCount'] || items.length;
                            return (
                              <td key={`${col.key}-${slot}`} className="px-2 py-2 align-top border-l border-[var(--color-bg-border)]/40 min-w-[120px]">
                                {count > 0 && (
                                  <div className="text-[9px] font-bold text-[var(--color-text-muted)] mb-1">{count} task{count !== 1 ? 's' : ''}</div>
                                )}
                                <div className="space-y-1">
                                  {items.map((task) => {
                                    const isDone = task.status === 'done';
                                    const workspaceColor = resolveTaskWorkspaceColor(task, workspaces, projects);
                                    return (
                                      <button
                                        key={task._id}
                                        type="button"
                                        onClick={() => onTaskClick?.(task)}
                                        style={isDone ? getCompletedTaskRowStyle(4) : getTaskRowStyle(workspaceColor, 4)}
                                        className={`tm-task-row flex w-full text-left rounded-lg border border-[var(--color-bg-border)] overflow-hidden hover:border-[var(--color-brand-teal)]/50 transition-colors ${
                                          isDone ? 'tm-task-row--completed' : ''
                                        }`}
                                      >
                                        <div
                                          className="w-1 shrink-0"
                                          style={{
                                            backgroundColor: isDone
                                              ? 'var(--color-pastel-slate-text)'
                                              : workspaceColor,
                                          }}
                                          aria-hidden
                                        />
                                        <div className="flex-1 min-w-0 px-2 py-1.5">
                                          <div className="truncate text-[10px] font-semibold">{task.title}</div>
                                          {task.type && (
                                            <div className="text-[8px] opacity-70 uppercase">{task.type}</div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ScheduleGrid;
