import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { getTodayDateKey } from '../../utils/dateValidation';
import { useAuth } from '../../contexts/AuthContext';
import {
  assignEntryLanes,
  buildTasksByUser,
  buildClusterLayout,
  coAssigneesFromTask,
  flattenDepartmentMembers,
  memberByIdFromMembers,
  orderScheduleClusters,
} from '../../utils/scheduleLayout';
import ScheduleTableHeader from './ScheduleTableHeader';
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

  const scheduleMemberById = useMemo(
    () => memberByIdFromMembers(flattenDepartmentMembers(data?.departments)),
    [data?.departments]
  );

  const memberClusters = useMemo(
    () => orderScheduleClusters(data?.departments, data?.tasks, dateKeys, currentUserId),
    [data?.departments, data?.tasks, dateKeys, currentUserId]
  );

  const clusterLayouts = useMemo(() => {
    const layouts = new Map();
    for (const cluster of memberClusters) {
      if (cluster.length > 1) {
        layouts.set(
          cluster.map((m) => m._id.toString()).join(','),
          buildClusterLayout(cluster, data?.tasks, dateKeys, scheduleMemberById)
        );
      }
    }
    return layouts;
  }, [memberClusters, data?.tasks, dateKeys, scheduleMemberById]);

  const memberPlacements = useMemo(() => {
    if (dateKeys.length === 0) return new Map();
    const placements = new Map();
    for (const cluster of memberClusters) {
      const clusterKey = cluster.map((m) => m._id.toString()).join(',');
      const layout = clusterLayouts.get(clusterKey);
      for (const member of cluster) {
        const uid = member._id.toString();
        if (layout) {
          placements.set(uid, {
            placement: layout.soloPlacements.get(uid),
            clusterKey,
          });
        } else {
          const userTasks = tasksByUser.get(uid) || [];
          const entries = userTasks.map((task) => ({
            task,
            coAssignees: coAssigneesFromTask(task, uid, scheduleMemberById),
          }));
          placements.set(uid, {
            placement: {
              lanes: assignEntryLanes(entries, dateKeys),
              tooltip: userTasks.map((t) => t.title).join(' · '),
              taskCount: userTasks.length,
            },
            clusterKey,
          });
        }
      }
    }
    return placements;
  }, [memberClusters, clusterLayouts, dateKeys, tasksByUser, scheduleMemberById]);

  if (!data) return null;
  const slotCount = dateKeys.length * 2;
  const colSpan = 1 + slotCount;

  const dayColumns = dateKeys.map((key, index) => {
    const parsed = parseISO(key);
    let label = format(parsed, 'EEE');
    if (key === todayKey) label = 'Today';
    else if (index === 1 && dateKeys[0] === todayKey) label = 'Tomorrow';
    return { key, label, sub: formatWeekdayDate(parsed) };
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
    <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-surface)]">
        <table className="w-full min-w-[640px] text-xs">
          {!hideTableHeader && (
            <ScheduleTableHeader dayColumns={dayColumns} slotHeaders={slotHeaders} memberPad={memberPad} />
          )}
          <tbody>
            {memberClusters.map((cluster) => {
              const isMulti = cluster.length > 1;

              return cluster.map((member) => {
                const uid = member._id.toString();
                const entry = memberPlacements.get(uid);

                return (
                  <ScheduleMemberRow
                    key={uid}
                    member={member}
                    placement={entry?.placement}
                    isCurrentUser={uid === currentUserId}
                    isClusterMember={isMulti}
                    {...rowProps}
                  />
                );
              });
            })}
          </tbody>
        </table>
    </div>
  );
};

export default ScheduleGrid;
