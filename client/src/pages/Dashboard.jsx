import React, { useState } from 'react';
import axios from 'axios';
import { LayoutDashboard } from 'lucide-react';
import { PageContainer, DashboardSkeleton, PageHeader } from '../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../lib/notifications';
import { buildTaskCompletionLogPayload, shouldClientCreateCompletionLog, taskCompletionToast, taskApprovalToast, resolveTaskId, canMarkTaskComplete, normalizeCompletionHours, pendingReviewToast } from '../utils/taskCompletion';
import { resolveTaskFinishIntent } from '../utils/taskReview';
import { updateAllTaskQueries } from '../utils/taskCache';
import { useTasks, useDashboardTasks, useReviewTasks, useProjects, useDashboardSummary } from '../hooks/useTaskmasterQueries';
import {
  AnnouncementsCard,
  ScheduleCard,
  TodosTodayCard,
  ReviewQueueCard,
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
  const { addToast } = useSystemToast();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useDashboardTasks(user?._id);
  const { data: reviewTasks = [], isLoading: reviewLoading } = useReviewTasks(!!user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [approvingReviewId, setApprovingReviewId] = useState(null);

  const loading = summaryLoading || tasksLoading || projectsLoading;
  const { calendar = [] } = summary || {};

  const handleCompleteRequest = (task) => {
    const intent = resolveTaskFinishIntent(task, user, projects);
    if (intent === 'approve') {
      handleApproveReview(task);
      return;
    }
    if (intent === 'awaiting_review' || !canMarkTaskComplete(task)) {
      if (task?.status === 'in-review') {
        addToast({ ...pendingReviewToast(task.title), module: MODULE.PROJECTS });
      }
      return;
    }
    setTaskToComplete(task);
  };

  const handleCompleteSubmit = async (task, hours) => {
    suppressAutoToasts(5000);
    const taskId = resolveTaskId(task);
    if (!taskId) {
      addToast({ title: 'Error', message: 'Invalid task. Refresh and try again.', type: 'error', module: MODULE.PROJECTS });
      return;
    }
    setCompletingTaskId(taskId);
    setTaskToComplete(null);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${taskId}`,
        { status: 'done', actualHours: normalizeCompletionHours(task.actualHours, hours) },
        AXIOS_SKIP_TOAST
      );
      const returnedStatus = taskRes.data?.status;
      if (shouldClientCreateCompletionLog(returnedStatus)) {
        axios.post(
          '/api/logs',
          buildTaskCompletionLogPayload(task, hours, projects),
          AXIOS_SKIP_TOAST
        ).catch(() => {});
      }
      const toast = taskCompletionToast(returnedStatus, task.title);
      addToast({ ...toast, duration: 5000, module: MODULE.PROJECTS });
      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) => (resolveTaskId(t) === taskId ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error || err.response?.data?.message || 'Failed',
        type: 'error',
        module: MODULE.PROJECTS,
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleApproveReview = async (task) => {
    const taskId = resolveTaskId(task);
    if (!taskId) return;
    suppressAutoToasts(5000);
    setApprovingReviewId(taskId);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${taskId}`,
        { reviewAction: 'approve' },
        AXIOS_SKIP_TOAST
      );
      addToast({
        ...taskApprovalToast(task.title),
        duration: 5000,
        module: MODULE.PROJECTS,
      });
      updateAllTaskQueries(queryClient, (list) =>
        (list || []).map((t) => (resolveTaskId(t) === taskId ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['tasks', 'review'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      addToast({
        title: 'Approval Failed',
        message: err.response?.data?.error || err.response?.data?.message || 'Could not approve task.',
        type: 'error',
        module: MODULE.PROJECTS,
      });
    } finally {
      setApprovingReviewId(null);
    }
  };

  if (loading && !tasks.length) return <PageContainer><DashboardSkeleton /></PageContainer>;

  return (
    <PageContainer className="!py-4 !space-y-4">
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
          <ReviewQueueCard
            tasks={reviewTasks}
            projects={projects}
            loading={reviewLoading}
            onApprove={handleApproveReview}
            approvingTaskId={approvingReviewId}
          />
          <TodosTodayCard
            tasks={tasks}
            projects={projects}
            loading={tasksLoading}
            onComplete={handleCompleteRequest}
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
