import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { PageContainer, PageHeader, EmptyState } from '../../components/ui';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import ScheduleSkeleton from '../../components/schedule/ScheduleSkeleton';
import { useSchedule } from '../../hooks/useTaskmasterQueries';
import TaskDetailModal from '../../components/TaskDetailModal';
import { CalendarDays } from 'lucide-react';

const SchedulePage = () => {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const { data, isLoading, isError, error } = useSchedule({ start: today, end: tomorrow });
  const [selectedTask, setSelectedTask] = useState(null);
  const tz = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || '';

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        title="Schedule"
        subtitle={`Today & tomorrow (${format(new Date(today), 'MMM d')} – ${format(new Date(tomorrow), 'MMM d')})${tz ? ` · ${tz}` : ''}`}
        icon={CalendarDays}
      />
      {isLoading ? (
        <ScheduleSkeleton />
      ) : isError ? (
        <EmptyState title="Could not load schedule" description={error?.message || 'Try refreshing the page.'} variant="subtle" />
      ) : !data?.departments?.length ? (
        <EmptyState title="No scheduled tasks" description="No tasks are scheduled for today or tomorrow." variant="subtle" />
      ) : (
        <ScheduleGrid data={data} onTaskClick={setSelectedTask} />
      )}

      <TaskDetailModal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['schedule'] })}
      />
    </PageContainer>
  );
};

export default SchedulePage;
