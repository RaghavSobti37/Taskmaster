import React, { useMemo } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { formatWeekdayDate } from '../../utils/dateDisplay';
import { tasksForScheduleDay, flattenDepartmentMembers } from '../../utils/scheduleLayout';
import MentionTitle from '../mentions/MentionTitle';
import { UserAvatar } from '../ui/UserAvatar';

const SLOT_LABEL = {
  AM: 'AM',
  PM: 'PM',
  FULL: 'All day',
};

function assigneeForTask(task, memberById) {
  const uid = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
  if (!uid) return null;
  return memberById.get(uid) || task.assignedTo;
}

export default function ScheduleMobileList({ data, visibleDayCount, onTaskClick }) {
  const dateKeys = useMemo(() => {
    if (!data?.start || !data?.end) return [];
    const allKeys = eachDayOfInterval({
      start: parseISO(data.start),
      end: parseISO(data.end),
    }).map((day) => format(day, 'yyyy-MM-dd'));
    if (!visibleDayCount || visibleDayCount >= allKeys.length) return allKeys;
    return allKeys.slice(0, visibleDayCount);
  }, [data?.start, data?.end, visibleDayCount]);

  const memberById = useMemo(() => {
    const map = new Map();
    for (const m of flattenDepartmentMembers(data?.departments)) {
      const id = m._id?.toString();
      if (id) map.set(id, m);
    }
    return map;
  }, [data?.departments]);

  const tasks = data?.tasks || [];

  if (dateKeys.length === 0) {
    return null;
  }

  return (
    <div className="lg:hidden space-y-4 min-w-0">
      {dateKeys.map((dayKey) => {
        const dayTasks = tasksForScheduleDay(tasks, dayKey);
        return (
          <section key={dayKey} className="min-w-0">
            <h2 className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-2 px-0.5">
              {formatWeekdayDate(dayKey)}
            </h2>
            {dayTasks.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] px-1 py-3 rounded-lg border border-dashed border-[var(--color-bg-border)]">
                No tasks scheduled
              </p>
            ) : (
              <ul className="space-y-2">
                {dayTasks.map((task) => {
                  const assignee = assigneeForTask(task, memberById);
                  const slot = SLOT_LABEL[task.scheduleSlot] || SLOT_LABEL.FULL;
                  return (
                    <li key={task._id?.toString() || task.title}>
                      <button
                        type="button"
                        onClick={() => onTaskClick?.(task)}
                        className="w-full text-left rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-3 py-3 flex items-start gap-3 min-h-[44px] active:ring-2 active:ring-[var(--color-action-primary)]/30"
                      >
                        <div className="min-w-0 flex-1">
                          <MentionTitle
                            text={task.title}
                            className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2"
                          />
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            {slot}
                            {task.status === 'done' ? ' · Done' : ''}
                          </p>
                        </div>
                        {assignee && (
                          <UserAvatar user={assignee} size="sm" className="shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
