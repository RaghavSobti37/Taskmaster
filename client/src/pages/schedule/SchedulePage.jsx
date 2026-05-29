import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { PageContainer, PageHeader, Card, DataLoading } from '../../components/ui';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import { useSchedule } from '../../hooks/useTaskmasterQueries';
import TaskDetailModal from '../../components/TaskDetailModal';

const SchedulePage = () => {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const { data, isLoading } = useSchedule({ start: today, end: tomorrow });
  const [selectedTask, setSelectedTask] = useState(null);

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        title="Team Schedule"
        subtitle="Today and tomorrow — half-day blocks split at 2pm. Only tasks from your projects are shown."
        icon={CalendarClock}
      />

      {isLoading ? (
        <Card className="p-2"><DataLoading message="Loading schedule..." /></Card>
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
