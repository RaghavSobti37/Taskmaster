import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Badge } from '../../components/ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { useProjects } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor, getTaskRowStyle, getCompletedTaskRowStyle } from '../../utils/workspaceColors';

const SLOT_COUNT = 4;
const AM_LABEL = 'AM · before 2pm';
const PM_LABEL = 'PM · after 2pm';

const getTaskDateKey = (task) => {
  const sched = task.scheduleDate || task.startDate || task.dueDate;
  if (!sched) return null;
  return format(new Date(sched), 'yyyy-MM-dd');
};

const getTaskPlacement = (task, dateKeys) => {
  const dateKey = getTaskDateKey(task);
  const dayIndex = dateKeys.indexOf(dateKey);
  if (dayIndex < 0) return null;

  const slot = task.scheduleSlot || 'FULL';
  if (slot === 'AM') return { startCol: dayIndex * 2, span: 1 };
  if (slot === 'PM') return { startCol: dayIndex * 2 + 1, span: 1 };
  return { startCol: dayIndex * 2, span: 2 };
};

const rangesOverlap = (a, b) => {
  const aEnd = a.startCol + a.span - 1;
  const bEnd = b.startCol + b.span - 1;
  return a.startCol <= bEnd && b.startCol <= aEnd;
};

const assignTaskLanes = (tasks, dateKeys) => {
  const placed = tasks
    .map((task) => {
      const placement = getTaskPlacement(task, dateKeys);
      if (!placement) return null;
      return { task, ...placement };
    })
    .filter(Boolean);

  const lanes = [];
  for (const item of placed) {
    let laneIndex = 0;
    while (laneIndex < lanes.length) {
      const overlaps = lanes[laneIndex].some((existing) => rangesOverlap(existing, item));
      if (!overlaps) break;
      laneIndex += 1;
    }
    if (!lanes[laneIndex]) lanes[laneIndex] = [];
    lanes[laneIndex].push(item);
  }
  return lanes;
};

const getTasksForUser = (userId, tasks) =>
  (tasks || []).filter((task) =>
    task.assignments?.some((a) => (a.userId?._id || a.userId)?.toString() === userId)
  );

const TaskPill = ({ task, workspaces, projects, compact, onTaskClick, style }) => {
  const isDone = task.status === 'done';
  const workspaceColor = resolveTaskWorkspaceColor(task, workspaces, projects);
  const taskMaxW = compact ? 'max-w-none w-full' : 'w-full max-w-none';

  return (
    <button
      type="button"
      onClick={() => onTaskClick?.(task)}
      title={task.title}
      style={{ ...style, ...(isDone ? getCompletedTaskRowStyle(4) : getTaskRowStyle(workspaceColor, 4)) }}
      className={`tm-task-row flex ${taskMaxW} text-left rounded border border-[var(--color-bg-border)] overflow-hidden hover:border-[var(--color-brand-teal)]/50 transition-colors ${
        isDone ? 'tm-task-row--completed' : ''
      }`}
    >
      <div
        className="w-0.5 shrink-0 self-stretch"
        style={{
          backgroundColor: isDone ? 'var(--color-pastel-slate-text)' : workspaceColor,
        }}
        aria-hidden
      />
      <span className="truncate text-[9px] font-semibold px-1 py-0.5 leading-tight">{task.title}</span>
    </button>
  );
};

const MemberTaskGrid = ({ lanes, slotCount, cellPad, compact, workspaces, projects, onTaskClick }) => {
  const laneGap = compact ? 'gap-0.5' : 'gap-1';
  const laneCount = Math.max(lanes.length, 1);

  return (
    <div
      className={`relative grid w-full ${laneGap}`}
      style={{
        gridTemplateColumns: `repeat(${slotCount}, minmax(90px, 1fr))`,
        gridTemplateRows: `repeat(${laneCount}, auto)`,
        minHeight: lanes.length === 0 ? '1.25rem' : undefined,
      }}
    >
      {[1, 2, 3].map((col) => (
        <div
          key={`divider-${col}`}
          className="pointer-events-none absolute top-0 bottom-0 border-l border-[var(--color-bg-border)]/40"
          style={{ left: `${(col / slotCount) * 100}%` }}
          aria-hidden
        />
      ))}
      {lanes.flatMap((lane, laneIdx) =>
        lane.map(({ task, startCol, span }) => (
          <div
            key={task._id}
            className={`${cellPad} min-w-0`}
            style={{
              gridColumn: `${startCol + 1} / span ${span}`,
              gridRow: laneIdx + 1,
            }}
          >
            <TaskPill
              task={task}
              workspaces={workspaces}
              projects={projects}
              compact={compact}
              onTaskClick={onTaskClick}
            />
          </div>
        ))
      )}
    </div>
  );
};

const ScheduleGrid = ({ data, onTaskClick, compact = false, hideTableHeader = false }) => {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const dateKeys = useMemo(
    () => (data ? [data.start, data.end].filter(Boolean) : []),
    [data?.start, data?.end]
  );

  if (!data) return null;
  const colSpan = 1 + SLOT_COUNT;

  const dayColumns = dateKeys.map((key, index) => ({
    key,
    label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : format(new Date(key), 'EEE'),
    sub: format(new Date(key), 'EEE, MMM d'),
  }));

  const slotHeaders = dateKeys.flatMap((key) => [
    { key: `${key}-AM`, dateKey: key, label: AM_LABEL },
    { key: `${key}-PM`, dateKey: key, label: PM_LABEL },
  ]);

  const memberPad = compact ? 'px-2 py-1.5' : 'px-2.5 py-2';
  const cellPad = compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5';
  const cellAlign = compact ? 'align-middle' : 'align-top';
  const avatarSize = compact ? 'w-5 h-5 text-[8px]' : 'w-6 h-6 text-[9px]';

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
      <table className="w-full min-w-[640px] text-xs">
        {!hideTableHeader && (
          <thead>
            <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
              <th
                className={`text-left ${memberPad} text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] w-36`}
              >
                Member
              </th>
              {dayColumns.map((col) => (
                <th
                  key={col.key}
                  colSpan={2}
                  className="text-center px-1.5 py-1.5 border-l border-[var(--color-bg-border)]"
                >
                  <div className="text-[9px] font-black uppercase tracking-widest">{col.label}</div>
                  <div className="text-[9px] text-[var(--color-text-muted)] font-normal normal-case tracking-normal">
                    {col.sub}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
              <th />
              {slotHeaders.map((slot, index) => (
                <th
                  key={slot.key}
                  className={`text-center px-1 py-1 text-[8px] font-bold uppercase text-[var(--color-text-muted)] ${
                    index % 2 === 0 ? 'border-l border-[var(--color-bg-border)]' : ''
                  }`}
                >
                  {slot.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {data.departments?.map((group) => (
            <React.Fragment key={group.department?._id || group.department?.slug}>
              <tr className="bg-[var(--color-bg-secondary)]/40">
                <td
                  colSpan={colSpan}
                  className="px-2.5 py-1.5 border-b border-t border-[var(--color-bg-border)] border-l-4 border-l-[var(--color-bg-border)]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {group.department?.name || 'Unassigned'}
                    </span>
                    <Badge variant="todo" className="!text-[8px] !py-0 !px-1.5">
                      {group.users?.length || 0}
                    </Badge>
                  </div>
                </td>
              </tr>
              {group.users?.map((member) => {
                const uid = member._id?.toString();
                const userTasks = getTasksForUser(uid, data.tasks);
                const lanes = assignTaskLanes(userTasks, dateKeys);
                const tooltip = userTasks.map((t) => t.title).join(' · ');

                return (
                  <tr
                    key={uid}
                    className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/30"
                  >
                    <td className={`${memberPad} ${cellAlign}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`${avatarSize} rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-bold shrink-0 overflow-hidden select-none`}
                        >
                          {member.avatar ? (
                            <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            member.name?.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="font-semibold text-[11px] truncate">{member.name}</div>
                      </div>
                    </td>
                    <td colSpan={SLOT_COUNT} className={`p-0 ${cellAlign}`} title={userTasks.length > 0 ? tooltip : undefined}>
                      <MemberTaskGrid
                        lanes={lanes}
                        slotCount={SLOT_COUNT}
                        cellPad={cellPad}
                        compact={compact}
                        workspaces={workspaces}
                        projects={projects}
                        onTaskClick={onTaskClick}
                      />
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleGrid;
