import React, { useState } from 'react';
import axios from 'axios';
import { PageContainer, DashboardSkeleton } from '../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTasks, useProjects, useDashboardSummary } from '../hooks/useTaskmasterQueries';
import {
  AnnouncementsCard,
  ScheduleCard,
  TodosTodayCard,
  ProjectsTodayCard,
  NotesPanel,
  PinBoardMessages,
  PinBoardComposer,
  LeaderboardPodium
} from '../components/dashboard';
import { PinBoardProvider } from '../components/dashboard/PinBoardContext';
import TaskCompletionModal from '../components/TaskCompletionModal';

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [taskToComplete, setTaskToComplete] = useState(null);

  const loading = summaryLoading || tasksLoading || projectsLoading;
  const { calendar = [] } = summary || {};

  const handleCompleteSubmit = async (task, hours) => {
    try {
      await axios.put(`/api/tasks/${task._id}`, { status: 'done', actualHours: (task.actualHours || 0) + hours });
      await axios.post('/api/logs', { action: 'TIME_LOG', targetType: 'Task', targetId: task._id, details: { hours, title: task.title } });
      addToast({ title: 'Task Finished (+20 XP)', message: `Completed "${task.title}"`, type: 'success', duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      setTaskToComplete(null);
    } catch (err) {
      addToast({ title: 'Error', message: err.response?.data?.error || 'Failed', type: 'error' });
    }
  };

  if (loading && !tasks.length) return <PageContainer><DashboardSkeleton /></PageContainer>;

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PinBoardProvider>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100vh-8rem)] lg:items-stretch">
        {/* Left: leaderboard + announcements + pin board + schedule */}
        <aside className="lg:col-span-3 flex flex-col gap-4 min-h-0 h-full">
          <LeaderboardPodium />
          <AnnouncementsCard />
          <PinBoardMessages />
          <ScheduleCard calendar={calendar} loading={summaryLoading} />
        </aside>

        {/* Center: todos + projects today */}
        <section className="lg:col-span-5 flex flex-col gap-4 min-h-0 h-full">
          <TodosTodayCard
            tasks={tasks}
            loading={tasksLoading}
            onComplete={setTaskToComplete}
          />
          <ProjectsTodayCard tasks={tasks} projects={projects} loading={tasksLoading} />
        </section>

        {/* Right: private notes + pin composer */}
        <aside className="lg:col-span-4 flex flex-col gap-4 min-h-0 h-full">
          <NotesPanel />
          <PinBoardComposer />
        </aside>
      </div>
      </PinBoardProvider>

      <TaskCompletionModal
        task={taskToComplete}
        isOpen={!!taskToComplete}
        onClose={() => setTaskToComplete(null)}
        onSubmit={handleCompleteSubmit}
      />
    </PageContainer>
  );
};

export default Dashboard;
