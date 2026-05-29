import React, { useState } from 'react';
import axios from 'axios';
import { LayoutDashboard } from 'lucide-react';
import { PageContainer, DashboardSkeleton, PageHeader } from '../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../lib/notifications';
import { buildTaskCompletionLogPayload, shouldClientCreateCompletionLog, taskCompletionToast } from '../utils/taskCompletion';
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
  const [completingTaskId, setCompletingTaskId] = useState(null);

  const loading = summaryLoading || tasksLoading || projectsLoading;
  const { calendar = [] } = summary || {};

  const handleCompleteSubmit = async (task, hours) => {
    suppressAutoToasts(5000);
    setCompletingTaskId(task._id);
    setTaskToComplete(null);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${task._id}`,
        { status: 'done', actualHours: (task.actualHours || 0) + hours },
        AXIOS_SKIP_TOAST
      );
      const returnedStatus = taskRes.data?.status;
      if (shouldClientCreateCompletionLog(returnedStatus)) {
        await axios.post(
          '/api/logs',
          buildTaskCompletionLogPayload(task, hours, projects),
          AXIOS_SKIP_TOAST
        );
      }
      const toast = taskCompletionToast(returnedStatus, task.title);
      addToast({ ...toast, duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      addToast({ title: 'Error', message: err.response?.data?.error || 'Failed', type: 'error' });
    } finally {
      setCompletingTaskId(null);
    }
  };

  if (loading && !tasks.length) return <PageContainer><DashboardSkeleton /></PageContainer>;

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
      />
      <PinBoardProvider>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:items-start">
        {/* Left: leaderboard + announcements + pin board + schedule */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          <LeaderboardPodium />
          <AnnouncementsCard />
          <PinBoardMessages />
          <ScheduleCard calendar={calendar} loading={summaryLoading} />
        </aside>

        {/* Center: todos + projects today */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <TodosTodayCard
            tasks={tasks}
            projects={projects}
            loading={tasksLoading}
            onComplete={setTaskToComplete}
            completingTaskId={completingTaskId}
          />
          <ProjectsTodayCard tasks={tasks} projects={projects} loading={tasksLoading} />
        </section>

        {/* Right: private notes + pin composer */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
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
