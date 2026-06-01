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
import { useTasks, useDashboardTasks, useReviewTasks, useProjects, useDashboardSummary, useDashboardPreset, useUserDirectory } from '../hooks/useTaskmasterQueries';
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
import UnifiedTimeCard from '../components/attendance/UnifiedTimeCard';
import { useAttendanceCheck, useUndoAttendanceCheck, useAttendance } from '../hooks/useTaskmasterQueries';
import { formatDateKeyIST } from '../utils/attendanceUtils';
import { format } from 'date-fns';
import { COMPONENT_REGISTRY, LAYOUT_TEMPLATES, canAccessComponent } from '../lib/componentRegistry';
import { isAdminUser } from '../utils/departmentPermissions';

const Dashboard = () => {
  const { user } = useAuth();
  const permissionPreset = useMemo(() => {
    if (isAdminUser(user)) return 'admin';
    const dept = user?.departmentId;
    return dept?.permissionPreset || dept?.slug || 'standard';
  }, [user]);
  const queryClient = useQueryClient();
  const { addToast } = useSystemToast();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useDashboardTasks(user?._id);
  const { data: reviewTasks = [], isLoading: reviewLoading } = useReviewTasks(!!user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: dashboardPreset, isLoading: presetLoading } = useDashboardPreset();
  const { data: users = [] } = useUserDirectory();

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayKey = formatDateKeyIST(today);
  const { data: attendanceRows = [] } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();
  const [isLocating, setIsLocating] = useState(false);

  const executeGeolocationCheck = (type, manualTime) => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkIn.mutate({ type, lat: position.coords.latitude, lng: position.coords.longitude, manualTime }, { onSettled: () => setIsLocating(false) });
        },
        (error) => {
          checkIn.mutate({ type, manualTime }, { onSettled: () => setIsLocating(false) }); // Fallback
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      checkIn.mutate({ type, manualTime }, { onSettled: () => setIsLocating(false) });
    }
  };


  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completionSubmitForReview, setCompletionSubmitForReview] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [approvingReviewId, setApprovingReviewId] = useState(null);

  const loading = summaryLoading || tasksLoading || projectsLoading || presetLoading;
  const calendar = useMemo(() => summary?.calendar || [], [summary]);

  const handleCompleteRequest = useCallback((task) => {
    const intent = resolveTaskFinishIntent(task, user, projects, users);
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
    setCompletionSubmitForReview(intent === 'submit_review');
    setTaskToComplete(task);
  }, [user, projects, users, addToast]);

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

  const defaultElements = LAYOUT_TEMPLATES.find(t => t.id === 'coreknot')?.elements || [];
  const elementsToRender = useMemo(
    () => (dashboardPreset?.elements?.length ? dashboardPreset.elements : defaultElements)
      .filter((el) => el.visible && canAccessComponent(el.componentId, permissionPreset)),
    [dashboardPreset?.elements, defaultElements, permissionPreset]
  );
  const maxGridRow = useMemo(
    () => elementsToRender.reduce((max, el) => Math.max(max, el.row || 1), 1),
    [elementsToRender]
  );

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
          <UnifiedTimeCard 
            entry={attendanceRows[0]}
            title={format(today, 'EEEE, MMMM d')}
            subTitle="Today"
            isSelfMode={true}
            onCheckIn={(t) => executeGeolocationCheck('in', t)}
            onCheckOut={(t) => executeGeolocationCheck('out', t)}
            onUndo={(type) => undoCheck.mutate({ type })}
            isLoading={isLocating || checkIn.isPending}
          />
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

  return (
    <PageContainer className="!py-4">
      <PinBoardProvider>
        <div
          className="dashboard-widget-grid grid grid-cols-1 lg:grid-cols-4 gap-0 grid-flow-row-dense auto-rows-max"
          style={{ '--grid-rows': maxGridRow }}
        >
          {elementsToRender
            .sort((a, b) => (a.row - b.row) || (a.col - b.col))
            .map((el) => {
              const span = parseInt(el.size, 10) || 1;
              return (
                <div
                  key={el.componentId}
                  className="flex flex-col min-h-0 dashboard-grid-item"
                  style={{ '--lg-col': el.col, '--lg-row': el.row, '--lg-span': span }}
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
        submitForReview={completionSubmitForReview}
      />
    </PageContainer>
  );
};

export default Dashboard;
