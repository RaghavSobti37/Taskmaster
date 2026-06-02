import React, { useMemo } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { getTodayDateKey } from '../../utils/dateValidation';
import { useAuth } from '../../contexts/AuthContext';
import {
  assignTaskLanes,
  buildTasksByUser,
  partitionDepartmentsForUser,
} from '../../utils/scheduleLayout';
import ScheduleTableHeader from './ScheduleTableHeader';
import ScheduleOwnSection, { ScheduleDepartmentHeader } from './ScheduleOwnSection';
import ScheduleMemberRow from './ScheduleMemberRow';

const AM_LABEL = 'AM · before 2pm';
const PM_LABEL = 'PM · after 2pm';

const ScheduleGrid = ({
  data,
  onTaskClick,
  compact = false,
  hideTableHeader = false,
  visibleDayCount,
  workspaces = [],
  projects = [],
}) => {
  const { user } = useAuth();
  const currentUserId = user?._id?.toString() || null;
  const todayKey = getTodayDateKey();

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

  const otherMemberLanes = useMemo(() => {
    if (!otherDepartments.length || dateKeys.length === 0) return new Map();
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
  }, [otherDepartments, dateKeys, tasksByUser]);

  if (!data) return null;
  const slotCount = dateKeys.length * 2;
  const colSpan = 1 + slotCount;

  const dayColumns = dateKeys.map((key, index) => {
    const parsed = parseISO(key);
    let label = format(parsed, 'EEE');
    if (key === todayKey) label = 'Today';
    else if (index === 1 && dateKeys[0] === todayKey) label = 'Tomorrow';
    return { key, label, sub: format(parsed, 'EEE, MMM d') };
  });

  const slotHeaders = dateKeys.flatMap((key) => [
    { key: `${key}-AM`, dateKey: key, label: AM_LABEL },
    { key: `${key}-PM`, dateKey: key, label: PM_LABEL },
  ]);

  const memberPad = compact ? 'px-2 py-1.5' : 'px-2.5 py-2';
  const cellPad = compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5';
  const cellAlign = compact ? 'align-middle' : 'align-top';
  const avatarSize = compact ? 'w-5 h-5 text-[8px]' : 'w-6 h-6 text-[9px]';

  const rowProps = {
    slotCount,
    memberPad,
    cellPad,
    cellAlign,
    avatarSize,
    compact,
    workspaces,
    projects,
    onTaskClick,
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
      <table className="w-full min-w-[640px] text-xs">
        {!hideTableHeader && (
          <ScheduleTableHeader dayColumns={dayColumns} slotHeaders={slotHeaders} memberPad={memberPad} />
        )}
        <tbody>
          <ScheduleOwnSection
            ownMember={ownMember}
            ownDepartment={ownDepartment}
            ownMemberLanes={ownMemberLanes}
            colSpan={colSpan}
            {...rowProps}
          />
          {otherDepartments.map((group) => (
            <React.Fragment key={group.department?._id || group.department?.slug}>
              <ScheduleDepartmentHeader group={group} colSpan={colSpan} />
              {group.users?.map((member) => (
                <ScheduleMemberRow
                  key={member._id?.toString()}
                  member={member}
                  placement={otherMemberLanes.get(member._id?.toString())}
                  {...rowProps}
                />
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleGrid;
