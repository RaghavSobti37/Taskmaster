import React, { useLayoutEffect, useMemo, useState } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Badge } from '../../components/ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { useProjects } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { resolveTaskWorkspaceColor, getTaskRowStyle, getCompletedTaskRowStyle } from '../../utils/workspaceColors';
import MentionTitle from '../mentions/MentionTitle';

const AM_LABEL = 'AM · before 2pm';
const PM_LABEL = 'PM · after 2pm';

const toDateKey = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
};

const resolveTaskSpan = (task) => {
  const startKey = toDateKey(task.startDate) || toDateKey(task.scheduleDate) || toDateKey(task.dueDate);
  const endKey = toDateKey(task.dueDate) || toDateKey(task.startDate) || toDateKey(task.scheduleDate);
  if (!startKey && !endKey) return null;
  let start = startKey || endKey;
  let end = endKey || startKey;
  if (start > end) [start, end] = [end, start];
  return { start, end };
};

const getTaskPlacement = (task, dateKeys) => {
  if (dateKeys.length === 0) return null;

  const span = resolveTaskSpan(task);
  if (!span) return null;

  const visibleStart = dateKeys[0];
  const visibleEnd = dateKeys[dateKeys.length - 1];
  if (span.end < visibleStart || span.start > visibleEnd) return null;

  const clippedStart = span.start < visibleStart ? visibleStart : span.start;
  const clippedEnd = span.end > visibleEnd ? visibleEnd : span.end;

  const startIndex = dateKeys.indexOf(clippedStart);
  const endIndex = dateKeys.indexOf(clippedEnd);
  if (startIndex < 0 || endIndex < 0) return null;

  const dayCount = endIndex - startIndex + 1;

  if (dayCount === 1) {
    const slot = task.scheduleSlot || 'FULL';
    if (slot === 'AM') return { startCol: startIndex * 2, span: 1 };
    if (slot === 'PM') return { startCol: startIndex * 2 + 1, span: 1 };
    return { startCol: startIndex * 2, span: 2 };
  }

  return { startCol: startIndex * 2, span: dayCount * 2 };
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

const buildTasksByUser = (tasks) => {
  const map = new Map();
  for (const task of tasks || []) {
    for (const assignment of task.assignments || []) {
      const userId = (assignment.userId?._id || assignment.userId)?.toString();
      if (!userId) continue;
      if (!map.has(userId)) map.set(userId, []);
      map.get(userId).push(task);
    }
  }
  return map;
};

/** Pull current user to a pinned top section; remaining dept groups exclude that member. */
const partitionDepartmentsForUser = (departments, currentUserId) => {
  if (!departments?.length) {
    return { ownMember: null, ownDepartment: null, otherDepartments: [] };
  }
  if (!currentUserId) {
    return { ownMember: null, ownDepartment: null, otherDepartments: departments };
  }

  const uid = currentUserId.toString();
  let ownMember = null;
  let ownDepartment = null;
  const otherDepartments = [];

  for (const group of departments) {
    const remaining = [];
    for (const member of group.users || []) {
      if (member._id?.toString() === uid) {
        ownMember = member;
        ownDepartment = group.department;
      } else {
        remaining.push(member);
      }
    }
    if (remaining.length > 0) {
      otherDepartments.push({ ...group, users: remaining });
    }
  }

  return { ownMember, ownDepartment, otherDepartments };
};

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
      <MentionTitle
        text={task.title}
        className="min-w-0 flex-1 truncate text-[9px] font-semibold px-1 py-0.5 leading-tight"
        truncate
      />
    </button>
  );
};

const MemberTaskGrid = ({ lanes, slotCount, cellPad, compact, workspaces, projects, onTaskClick }) => {
  const laneGap = compact ? 'gap-0.5' : 'gap-1';
  const laneCount = Math.max(lanes.length, 1);

  return (
    <div className="min-w-0">
      <div
        className={`relative grid w-full ${laneGap}`}
        style={{
          gridTemplateColumns: `repeat(${slotCount}, minmax(90px, 1fr))`,
          gridTemplateRows: `repeat(${laneCount}, auto)`,
          minHeight: lanes.length === 0 ? '1.25rem' : undefined,
        }}
      >
        {[...Array(Math.max(slotCount - 1, 0))].map((_, index) => (
          <div
            key={`divider-${index}`}
            className="pointer-events-none absolute top-0 bottom-0 border-l border-[var(--color-bg-border)]/40"
            style={{ left: `${((index + 1) / slotCount) * 100}%` }}
            aria-hidden
          />
        ))}
        {lanes.flatMap((lane, laneIdx) =>
          lane.map(({ task, startCol, span }) => (
            <div
              key={task._id}
              className={`${cellPad} min-w-0 overflow-hidden`}
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
    </div>
  );
};

const ScheduleGrid = ({ data, onTaskClick, compact = false, hideTableHeader = false, visibleDayCount }) => {
  const { user } = useAuth();
  const currentUserId = user?._id?.toString() || null;
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const [showOtherMembers, setShowOtherMembers] = useState(false);

  const dateKeys = useMemo(() => {
    if (!data?.start || !data?.end) return [];
    const allKeys = eachDayOfInterval({
      start: parseISO(data.start),
      end: parseISO(data.end),
    }).map((day) => format(day, 'yyyy-MM-dd'));
    if (!visibleDayCount || visibleDayCount >= allKeys.length) return allKeys;
    return allKeys.slice(0, visibleDayCount);
  }, [data?.start, data?.end, visibleDayCount]);

  const tasksByUser = useMemo(() => buildTasksByUser(data?.tasks), [data?.tasks]);

  const { ownMember, ownDepartment, otherDepartments } = useMemo(
    () => partitionDepartmentsForUser(data?.departments, currentUserId),
    [data?.departments, currentUserId]
  );

  useLayoutEffect(() => {
    if (!ownMember) {
      setShowOtherMembers(true);
      return undefined;
    }
    setShowOtherMembers(false);
    const frame = requestAnimationFrame(() => setShowOtherMembers(true));
    return () => cancelAnimationFrame(frame);
  }, [ownMember, data?.start, data?.end, visibleDayCount]);

  const ownMemberLanes = useMemo(() => {
    if (!ownMember || dateKeys.length === 0) return null;
    const uid = ownMember._id?.toString();
    if (!uid) return null;
    const userTasks = tasksByUser.get(uid) || [];
    return {
      lanes: assignTaskLanes(userTasks, dateKeys),
      tooltip: userTasks.map((t) => t.title).join(' · '),
      taskCount: userTasks.length,
    };
  }, [ownMember, dateKeys, tasksByUser]);

  const shouldShowOthers = showOtherMembers || !ownMember;

  const otherMemberLanes = useMemo(() => {
    if (!shouldShowOthers || !otherDepartments.length || dateKeys.length === 0) return new Map();
    const lanesByUser = new Map();
    for (const group of otherDepartments) {
      for (const member of group.users || []) {
        const uid = member._id?.toString();
        if (!uid) continue;
        const userTasks = tasksByUser.get(uid) || [];
        lanesByUser.set(uid, {
          lanes: assignTaskLanes(userTasks, dateKeys),
          tooltip: userTasks.map((t) => t.title).join(' · '),
          taskCount: userTasks.length,
        });
      }
    }
    return lanesByUser;
  }, [shouldShowOthers, otherDepartments, dateKeys, tasksByUser]);

  const getMemberPlacement = (uid) => {
    if (ownMember?._id?.toString() === uid) return ownMemberLanes;
    return otherMemberLanes.get(uid);
  };

  if (!data) return null;
  const slotCount = dateKeys.length * 2;
  const colSpan = 1 + slotCount;

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

  const renderDepartmentHeader = (group, { isOwn = false } = {}) => (
    <tr key={`dept-${group.department?._id || group.department?.slug}${isOwn ? '-own' : ''}`} className="bg-[var(--color-bg-secondary)]/40">
      <td
        colSpan={colSpan}
        className="px-2.5 py-1.5 border-b border-t border-[var(--color-bg-border)] border-l-4 border-l-[var(--color-bg-border)]"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest">
            {group.department?.name || 'Unassigned'}
          </span>
          {isOwn && (
            <Badge variant="todo" className="!text-[8px] !py-0 !px-1.5 !bg-[var(--color-brand-teal)]/15 !text-[var(--color-brand-teal)]">
              You
            </Badge>
          )}
          <Badge variant="todo" className="!text-[8px] !py-0 !px-1.5">
            {group.users?.length || 0}
          </Badge>
        </div>
      </td>
    </tr>
  );

  const renderMemberRow = (member) => {
    const uid = member._id?.toString();
    const placement = getMemberPlacement(uid);
    const lanes = placement?.lanes || [];
    const tooltip = placement?.tooltip || '';
    const taskCount = placement?.taskCount || 0;

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
        <td colSpan={slotCount} className={`p-0 ${cellAlign} overflow-hidden`} title={taskCount > 0 ? tooltip : undefined}>
          <MemberTaskGrid
            lanes={lanes}
            slotCount={slotCount}
            cellPad={cellPad}
            compact={compact}
            workspaces={workspaces}
            projects={projects}
            onTaskClick={onTaskClick}
          />
        </td>
      </tr>
    );
  };

  const renderDepartmentGroup = (group) => (
    <React.Fragment key={group.department?._id || group.department?.slug}>
      {renderDepartmentHeader(group)}
      {group.users?.map((member) => renderMemberRow(member))}
    </React.Fragment>
  );

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
          {ownMember && (
            <React.Fragment key="schedule-own">
              {renderDepartmentHeader({ department: ownDepartment, users: [ownMember] }, { isOwn: true })}
              {renderMemberRow(ownMember)}
            </React.Fragment>
          )}
          {shouldShowOthers && otherDepartments.map((group) => renderDepartmentGroup(group))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleGrid;
