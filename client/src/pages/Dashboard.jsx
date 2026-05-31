import React, { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Settings, LayoutDashboard } from 'lucide-react';
import { PageContainer, DashboardSkeleton, PageHeader, Button } from '../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../lib/notifications';
import { buildTaskCompletionLogPayload, shouldClientCreateCompletionLog, taskCompletionToast, taskApprovalToast, resolveTaskId, canMarkTaskComplete, normalizeCompletionHours, pendingReviewToast } from '../utils/taskCompletion';
import { resolveTaskFinishIntent } from '../utils/taskReview';
import { updateAllTaskQueries } from '../utils/taskCache';
import { useTasks, useDashboardTasks, useReviewTasks, useProjects, useDashboardSummary, useDashboardPreset } from '../hooks/useTaskmasterQueries';
import {
  AnnouncementsCard,
  ScheduleCard,
  TodosTodayCard,
  TodosOverdueCard,
  ReviewQueueCard,
  ProjectsTodayCard,
  NotesPanel,
  PinBoardMessages,
  PinBoardComposer,
  LeaderboardPodium,
  PipelineSummaryCard,
  GenericDashboardCard
} from '../components/dashboard';
import { PinBoardProvider } from '../components/dashboard/PinBoardContext';
import TaskCompletionModal from '../components/TaskCompletionModal';
import { COMPONENT_REGISTRY, LAYOUT_TEMPLATES } from '../lib/componentRegistry';

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useSystemToast();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useDashboardTasks(user?._id);
  const { data: reviewTasks = [], isLoading: reviewLoading } = useReviewTasks(!!user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: dashboardPreset, isLoading: presetLoading } = useDashboardPreset();

  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [approvingReviewId, setApprovingReviewId] = useState(null);

  const loading = summaryLoading || tasksLoading || projectsLoading || presetLoading;
  const calendar = useMemo(() => summary?.calendar || [], [summary]);

  const handleCompleteRequest = useCallback((task) => {
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
  }, [user, projects, addToast]);

  const handleCompleteSubmit = useCallback(async (task, hours) => {
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
        ).catch(() => { });
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
  }, [projects, queryClient, addToast]);

  const handleApproveReview = useCallback(async (task) => {
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
  }, [queryClient, addToast]);

  if (loading && !tasks.length) return <PageContainer><DashboardSkeleton /></PageContainer>;

  const renderComponent = (componentId) => {
    switch (componentId) {
      case 'leaderboard': return <LeaderboardPodium />;
      case 'announcements': return <AnnouncementsCard />;
      case 'pinboard': return <PinBoardMessages />;
      case 'schedule': return <ScheduleCard calendar={calendar} loading={summaryLoading} />;
      case 'review-queue': return <ReviewQueueCard tasks={reviewTasks} projects={projects} loading={reviewLoading} onApprove={handleApproveReview} approvingTaskId={approvingReviewId} />;
      case 'todos-today': return <TodosTodayCard tasks={tasks} projects={projects} loading={tasksLoading} onComplete={handleCompleteRequest} completingTaskId={completingTaskId} />;
      case 'todos-overdue': return <TodosOverdueCard tasks={tasks} projects={projects} loading={tasksLoading} onComplete={handleCompleteRequest} completingTaskId={completingTaskId} />;
      case 'projects-today': return <ProjectsTodayCard tasks={tasks} projects={projects} loading={tasksLoading} />;
      case 'notes': return <NotesPanel />;
      case 'composer': return <PinBoardComposer />;
      case 'mark-attendance':
        return (
          <div className="bg-[var(--color-bg-primary)] p-6 rounded-xl flex flex-col items-center justify-center border border-[var(--color-bg-border)] h-full gap-3 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="text-3xl">⏰</div>
            <div className="text-center">
              <h3 className="font-bold text-[var(--color-text-primary)]">Ready for the day?</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3">You haven't clocked in yet.</p>
            </div>
            <button className="h-10 w-32 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform active:scale-95">
              <span className="text-white text-sm font-bold tracking-wide">Clock In</span>
            </button>
          </div>
        );

      case 'pipeline-summary':
        return <PipelineSummaryCard />;

      case 'leave-alerts':
      case 'invoice-alerts':
      case 'booked-calls':
      case 'followups-today':
      case 'team-activity':
      case 'dept-stats':
      case 'attendance-overview':
      case 'campaign-metrics':
      case 'system-health':
      case 'artist-calendar':
        return <GenericDashboardCard componentId={componentId} />;
      default: return null;
    }
  };

  // Default layout if no preset or fallback
  const defaultElements = LAYOUT_TEMPLATES.find(t => t.id === 'taskmaster')?.elements || [];

  const elementsToRender = (dashboardPreset?.elements && dashboardPreset.elements.length > 0 ? dashboardPreset.elements : defaultElements)
    .filter(el => el.visible);

  return (
    <PageContainer className="!py-4 !space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-blue-500" />
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">Raghav</h1>
        </div>
      </div>

      <PinBoardProvider>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 grid-flow-row-dense auto-rows-max">
          {elementsToRender
            .sort((a, b) => (a.row - b.row) || (a.col - b.col))
            .map((el) => {
              const colSpanClass = el.size === '4' ? 'lg:col-span-4' :
                el.size === '3' ? 'lg:col-span-3' :
                  el.size === '2' ? 'lg:col-span-2' :
                    'lg:col-span-1';
              return (
                <div
                  key={el.componentId}
                  className={`flex flex-col gap-4 h-full dashboard-grid-item ${colSpanClass}`}
                  style={{ '--lg-col': el.col, '--lg-row': el.row }}
                >
                  {renderComponent(el.componentId)}
                </div>
              );
            })}
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
