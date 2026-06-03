import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTodayDateKey } from '../../utils/dateValidation';
import { addDaysToDateKey } from '../../utils/scheduleTaskDates';
import ListPageLayout from '../../components/ui/ListPageLayout';
import EmptyState from '../../components/ui/EmptyState';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import ScheduleSkeleton from '../../components/schedule/ScheduleSkeleton';
import ScheduleDayViewControl from '../../components/schedule/ScheduleDayViewControl';
import { useSchedule, useWorkspaces, useProjects } from '../../hooks/useTaskmasterQueries';
import { useStatusCounts } from '../../hooks/useStatusCounts';

const TaskDetailModal = lazy(() => import('../../components/TaskDetailModal'));
import { CalendarDays, Users, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const MAX_SCHEDULE_DAYS = 5;

const SchedulePage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dayCount, setDayCount] = useState(2);
  const [selectedTask, setSelectedTask] = useState(null);
  const today = getTodayDateKey();
  const scheduleEnd = addDaysToDateKey(today, MAX_SCHEDULE_DAYS - 1);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const { data: scheduleData, isPending, isError, error } = useSchedule({ start: today, end: scheduleEnd });
  const { data: statusCounts } = useStatusCounts(!!user);

  const scheduleStats = useMemo(() => {
    const tasks = scheduleData?.tasks || [];
    const departments = scheduleData?.departments || [];
    const people = departments.reduce((sum, d) => sum + (d.members?.length || 0), 0);
    return {
      scheduledTasks: tasks.length,
      departments: departments.length,
      people,
    };
  }, [scheduleData]);

  const dayLabel = dayCount === 1 ? '1 day' : `${dayCount} days`;
  const showInitialSkeleton = isPending && !scheduleData;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'tasks',
            label: 'Scheduled Tasks',
            value: scheduleStats.scheduledTasks,
            icon: Layers,
            variant: 'mint',
            info: `Tasks with schedule slots in the next ${dayLabel}.`,
          },
          {
            id: 'depts',
            label: 'Departments',
            value: scheduleStats.departments,
            icon: Users,
            variant: 'info',
            info: 'Team groupings shown on the schedule grid.',
          },
          {
            id: 'people',
            label: 'People',
            value: scheduleStats.people,
            icon: Users,
            variant: 'slate',
            info: 'Members with rows on the schedule.',
          },
          {
            id: 'due-today',
            label: 'Your Due Today',
            value: statusCounts?.tasks?.today ?? 0,
            icon: CalendarDays,
            variant: 'apricot',
            info: 'Your assigned tasks due today (from todo scope).',
          },
        ],
      }}
    >
      <ScheduleDayViewControl
        dayCount={dayCount}
        onDayCountChange={setDayCount}
        rangeStartKey={today}
        maxDays={MAX_SCHEDULE_DAYS}
      />
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

      {selectedTask && (
        <Suspense fallback={null}>
          <TaskDetailModal
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            task={selectedTask}
            onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['schedule'] })}
          />
        </Suspense>
      )}
    </ListPageLayout>
  );
};

export default SchedulePage;
