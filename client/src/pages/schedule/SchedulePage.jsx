import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTodayDateKey } from '../../utils/dateValidation';
import { addDaysToDateKey } from '../../utils/scheduleTaskDates';
import { EmptyState, ListPageLayout } from '../../components/ui';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import ScheduleSkeleton from '../../components/schedule/ScheduleSkeleton';
import { useSchedule, useWorkspaces, useProjects } from '../../hooks/useTaskmasterQueries';
import TaskDetailModal from '../../components/TaskDetailModal';
import { CalendarDays } from 'lucide-react';

export const MAX_SCHEDULE_DAYS = 5;

const SchedulePage = () => {
  const queryClient = useQueryClient();
  const [dayCount, setDayCount] = useState(2);
  const [selectedTask, setSelectedTask] = useState(null);
  const today = getTodayDateKey();
  const scheduleEnd = addDaysToDateKey(today, MAX_SCHEDULE_DAYS - 1);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const { data: scheduleData, isPending, isError, error } = useSchedule({ start: today, end: scheduleEnd });

  const dayLabel = dayCount === 1 ? '1 day' : `${dayCount} days`;
  const showInitialSkeleton = isPending && !scheduleData;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      icon={CalendarDays}
      title="Schedule"
      toolbarActions={
        <div className="flex items-center gap-2.5 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-3 py-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap">
            View
          </span>
          <input
            type="range"
            min={1}
            max={MAX_SCHEDULE_DAYS}
            step={1}
            value={dayCount}
            onChange={(e) => setDayCount(Number(e.target.value))}
            aria-label="Days to show in schedule"
            className="schedule-day-slider w-24 sm:w-28 accent-[var(--color-action-primary)] cursor-pointer"
          />
          <span className="text-[10px] font-bold text-[var(--color-text-primary)] tabular-nums min-w-[3rem] text-right">
            {dayLabel}
          </span>
        </div>
      }
    >
      {isError ? (
        <EmptyState title="Could not load schedule" description={error?.message || 'Try refreshing the page.'} variant="subtle" />
      ) : showInitialSkeleton ? (
        <ScheduleSkeleton dayCount={dayCount} />
      ) : !scheduleData?.departments?.length ? (
        <EmptyState
          title="No scheduled tasks"
          description={`No active tasks are scheduled for the next ${dayLabel}.`}
          variant="subtle"
        />
      ) : (
        <ScheduleGrid
          data={scheduleData}
          visibleDayCount={dayCount}
          workspaces={workspaces}
          projects={projects}
          onTaskClick={setSelectedTask}
        />
      )}

      <TaskDetailModal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['schedule'] })}
      />
    </ListPageLayout>
  );
};

export default SchedulePage;
