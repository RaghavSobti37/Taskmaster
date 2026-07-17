import React, { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { loadPageFilters, savePageFilters } from '../../utils/pageFilterStorage';
import { useQueryClient } from '@tanstack/react-query';
import { getTodayDateKey } from '../../utils/dateValidation';
import { addDaysToDateKey } from '../../utils/scheduleTaskDates';
import ListPageLayout from '../../components/ui/ListPageLayout';
import EmptyState from '../../components/ui/EmptyState';
import { DesktopRecommendedBanner, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import ScheduleMobileList from '../../components/schedule/ScheduleMobileList';
import ScheduleSkeleton from '../../components/schedule/ScheduleSkeleton';
import ScheduleDayViewControl from '../../components/schedule/ScheduleDayViewControl';
import { useSchedule, useWorkspaces, useProjects, useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { useStatusCounts } from '../../hooks/useStatusCounts';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { useDashboardTaskActions } from '../../hooks/useDashboardTaskActions';

const TaskDetailModal = lazy(() => import('../../components/TaskDetailModal'));
const TaskCompletionModal = lazy(() => import('../../components/TaskCompletionModal'));
import { CalendarDays, Users, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const MAX_SCHEDULE_DAYS = 5;

const SCHEDULE_FILTERS_KEY = 'schedule-filters';

const SchedulePage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dayCount, setDayCount] = useState(() => {
    const saved = loadPageFilters(SCHEDULE_FILTERS_KEY, { dayCount: 2 });
    const n = Number(saved.dayCount);
    return Number.isFinite(n) && n >= 1 && n <= MAX_SCHEDULE_DAYS ? n : 2;
  });

  useEffect(() => {
    savePageFilters(SCHEDULE_FILTERS_KEY, { dayCount });
  }, [dayCount]);
  const [selectedTask, setSelectedTask] = useState(null);
  const today = getTodayDateKey();
  const scheduleEnd = addDaysToDateKey(today, MAX_SCHEDULE_DAYS - 1);
  const { data: scheduleData, isPending, isError, error, refetch } = useSchedule({ start: today, end: scheduleEnd });
  const deferScheduleFilters = useDeferredQueryEnabled(!isPending);
  const { data: workspaces = [] } = useWorkspaces(deferScheduleFilters);
  const { data: projects = [] } = useProjects(deferScheduleFilters);
  const { data: users = [] } = useUserDirectory(deferScheduleFilters);
  const { data: statusCounts } = useStatusCounts(!!user && deferScheduleFilters);
  const {
    taskToComplete,
    setTaskToComplete,
    taskToApprove,
    setTaskToApprove,
    completionSubmitForReview,
    handleCompleteRequest,
    handleCompleteSubmit,
    handleApproveReview,
  } = useDashboardTaskActions({ user, projects, users });

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
      <DesktopRecommendedBanner message="Day-grouped list below on mobile; full department grid on desktop." />

      <div className="lg:hidden space-y-3">
        <ScheduleDayViewControl
          dayCount={dayCount}
          onDayCountChange={setDayCount}
          rangeStartKey={today}
          maxDays={MAX_SCHEDULE_DAYS}
        />
        {isError ? (
          <QueryErrorBanner
            message={getQueryErrorMessage(error, 'Could not load schedule')}
            onRetry={() => refetch()}
          />
        ) : showInitialSkeleton ? (
          <ScheduleSkeleton dayCount={dayCount} />
        ) : !scheduleData?.departments?.length ? (
          <EmptyState
            title="No scheduled tasks"
            description={`No active tasks are scheduled for the next ${dayLabel}.`}
            variant="subtle"
          />
        ) : (
          <ScheduleMobileList
            data={scheduleData}
            visibleDayCount={dayCount}
            onTaskClick={setSelectedTask}
          />
        )}
      </div>

      <div className="hidden lg:block space-y-3">
        <ScheduleDayViewControl
          dayCount={dayCount}
          onDayCountChange={setDayCount}
          rangeStartKey={today}
          maxDays={MAX_SCHEDULE_DAYS}
        />
        {isError ? (
          <QueryErrorBanner
            message={getQueryErrorMessage(error, 'Could not load schedule')}
            onRetry={() => refetch()}
          />
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
      </div>

      {(selectedTask || taskToComplete || taskToApprove) && (
        <Suspense fallback={null}>
          <TaskDetailModal
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            task={selectedTask}
            onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['schedule'] })}
            onFinishRequest={handleCompleteRequest}
          />
          <TaskCompletionModal
            task={taskToComplete}
            isOpen={!!taskToComplete}
            onClose={() => setTaskToComplete(null)}
            onSubmit={handleCompleteSubmit}
            submitForReview={completionSubmitForReview}
          />
          <TaskCompletionModal
            task={taskToApprove}
            isOpen={!!taskToApprove}
            onClose={() => setTaskToApprove(null)}
            onSubmit={handleApproveReview}
            approveReview
          />
        </Suspense>
      )}
    </ListPageLayout>
  );
};

export default SchedulePage;
