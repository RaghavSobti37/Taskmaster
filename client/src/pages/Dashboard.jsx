import React, { useMemo, Suspense, useState, useEffect, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { PageContainer, Button } from '../components/ui/primitives';
import QueryErrorBanner, { getQueryErrorMessage } from '../components/ui/QueryErrorBanner';
import DashboardWidgetSkeleton from '../components/ui/DashboardWidgetSkeleton';
import { useAuth } from '../contexts/AuthContext';
import {
  useDashboardTasks,
  useReviewTasks,
  useProjects,
  useWorkspaces,
  useDashboardSummary,
  useDashboardPreset,
  useUserDirectory,
} from '../hooks/useTaskmasterQueries';
import { useDashboardTaskActions } from '../hooks/useDashboardTaskActions';
import { PinBoardProvider } from '../components/dashboard/PinBoardContext';
import DashboardTierLayout from '../components/dashboard/DashboardTierLayout';
import PostHogCard from '../components/dashboard/PostHogCard';
const TaskCompletionModal = lazy(() => import('../components/TaskCompletionModal'));
const MobileAttendanceBar = lazy(() => import('../components/mobile/MobileAttendanceBar'));
import { useAttendanceCheck, useUndoAttendanceCheck, useAttendance } from '../hooks/useTaskmasterQueries';
import { formatDateKeyIST } from '../utils/attendanceUtils';
import {
  getDefaultLayoutElements,
  canAccessComponent,
  isAnalyticsWidget,
  DASHBOARD_SETTINGS_PATH,
} from '../lib/componentRegistry';
import {
  normalizeDashboardElements,
  repackDashboardElements,
} from '../lib/dashboardSections';
import { getLazyDashboardWidget } from '../lib/dashboardWidgetLoaders';
import { isAdminUser } from '../utils/departmentPermissions';

const renderLazyWidget = (componentId, props = {}) => {
  const LazyComp = getLazyDashboardWidget(componentId);
  if (!LazyComp) return null;
  return (
    <Suspense fallback={<DashboardWidgetSkeleton />}>
      <LazyComp {...props} />
    </Suspense>
  );
};

const PRIORITY_WIDGET_IDS = new Set([
  'mark-attendance',
  'todos-today',
  'schedule',
  'announcements',
  'review-queue',
  'todos-overdue',
]);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, sessionReady } = useAuth();
  const queriesEnabled = !!user?._id && sessionReady;
  const permissionPreset = useMemo(() => {
    if (isAdminUser(user)) return 'admin';
    const dept = user?.departmentId;
    return dept?.permissionPreset || dept?.slug || 'standard';
  }, [user]);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryErr, refetch: refetchSummary } = useDashboardSummary(queriesEnabled, { fields: 'calendar' });
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErr,
    refetch: refetchTasks,
  } = useDashboardTasks(user?._id, queriesEnabled);
  const {
    data: reviewTasks = [],
    isLoading: reviewLoading,
    isError: reviewError,
    error: reviewErr,
    refetch: refetchReview,
  } = useReviewTasks(queriesEnabled);
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErr,
    refetch: refetchProjects,
  } = useProjects(queriesEnabled);
  const { data: workspaces = [] } = useWorkspaces(queriesEnabled);
  const { data: dashboardPreset } = useDashboardPreset(queriesEnabled);
  const { data: users = [] } = useUserDirectory(queriesEnabled);

  const {
    taskToComplete,
    setTaskToComplete,
    taskToApprove,
    setTaskToApprove,
    completionSubmitForReview,
    completingTaskId,
    approvingReviewId,
    handleCompleteRequest,
    handleCompleteSubmit,
    handleApproveReview,
  } = useDashboardTaskActions({ user, projects, users });

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayKey = formatDateKeyIST(today);
  const {
    data: attendanceRows = [],
    isError: attendanceError,
    error: attendanceErr,
    refetch: refetchAttendance,
  } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();

  const executeAttendanceCheck = (type, manualTime, workMode) => {
    checkIn.mutate({ type, manualTime, workMode: workMode === 'wfh' ? 'wfh' : 'office' });
  };

  const calendar = useMemo(() => summary?.calendar || [], [summary]);

  const layoutElements = useMemo(() => {
    const raw = dashboardPreset?.elements?.length
      ? dashboardPreset.elements
      : getDefaultLayoutElements(permissionPreset);
    return repackDashboardElements(normalizeDashboardElements(raw, permissionPreset));
  }, [dashboardPreset?.elements, permissionPreset]);

  const [secondaryWidgetsReady, setSecondaryWidgetsReady] = useState(false);
  const [heavyWidgetsReady, setHeavyWidgetsReady] = useState(false);
  useEffect(() => {
    const enableSecondary = () => setSecondaryWidgetsReady(true);
    const enableHeavy = () => setHeavyWidgetsReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const secondaryId = window.requestIdleCallback(enableSecondary, { timeout: 800 });
      const heavyId = window.requestIdleCallback(enableHeavy, { timeout: 2000 });
      return () => {
        window.cancelIdleCallback(secondaryId);
        window.cancelIdleCallback(heavyId);
      };
    }
    const secondaryTimer = window.setTimeout(enableSecondary, 200);
    const heavyTimer = window.setTimeout(enableHeavy, 500);
    return () => {
      window.clearTimeout(secondaryTimer);
      window.clearTimeout(heavyTimer);
    };
  }, []);

  const renderComponent = (componentId, _options = {}) => {
    if (!secondaryWidgetsReady && !PRIORITY_WIDGET_IDS.has(componentId) && !isAnalyticsWidget(componentId)) {
      return <DashboardWidgetSkeleton />;
    }
    if (!heavyWidgetsReady && isAnalyticsWidget(componentId)) {
      return <DashboardWidgetSkeleton />;
    }

    switch (componentId) {
      case 'leaderboard':
        return renderLazyWidget('leaderboard');
      case 'daily-missions':
        return renderLazyWidget('daily-missions');
      case 'announcements':
        return renderLazyWidget('announcements');
      case 'pinboard':
        return renderLazyWidget('pinboard');
      case 'schedule':
        return renderLazyWidget('schedule', { calendar, loading: summaryLoading });
      case 'review-queue':
        return renderLazyWidget('review-queue', {
          tasks: reviewTasks,
          projects,
          workspaces,
          loading: reviewLoading,
          onApprove: (task) => setTaskToApprove(task),
          approvingTaskId: approvingReviewId,
          onOpenProject: (projectId) => navigate(`/projects/${projectId}`),
        });
      case 'todos-today':
        return renderLazyWidget('todos-today', {
          tasks,
          projects,
          loading: tasksLoading,
          onComplete: handleCompleteRequest,
          completingTaskId,
        });
      case 'todos-overdue':
        return renderLazyWidget('todos-overdue', {
          tasks,
          projects,
          loading: tasksLoading,
          onComplete: handleCompleteRequest,
          completingTaskId,
        });
      case 'projects-today':
        return renderLazyWidget('projects-today', {
          tasks,
          projects,
          loading: tasksLoading || projectsLoading,
        });
      case 'notes':
        return renderLazyWidget('notes');
      case 'composer':
        return renderLazyWidget('composer');
      case 'mark-attendance':
        return renderLazyWidget('mark-attendance', {
          entry: attendanceRows[0],
          onCheckIn: (t, workMode) => executeAttendanceCheck('in', t, workMode),
          onCheckOut: (t, workMode) => executeAttendanceCheck('out', t, workMode),
          onUndo: (type) => undoCheck.mutate({ type }),
          isLoading: checkIn.isPending,
        });
      case 'pipeline-summary':
        return renderLazyWidget('pipeline-summary');
      case 'leave-alerts':
        return renderLazyWidget('leave-alerts');
      case 'invoice-alerts':
        return renderLazyWidget('invoice-alerts');
      case 'booked-calls':
      case 'followups-today':
      case 'team-activity':
      case 'dept-stats':
      case 'campaign-metrics':
      case 'system-health':
      case 'artist-calendar':
        return renderLazyWidget(componentId, { componentId, tasks });
      case 'render-logs':
        return renderLazyWidget('render-logs');
      case 'posthog':
        return <PostHogCard />;
      case 'attendance-overview':
        return renderLazyWidget('attendance-overview');
      case 'last-backup':
        return renderLazyWidget('last-backup');
      default:
        return null;
    }
  };

  return (
    <PageContainer>
      {summaryError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(summaryErr, 'Failed to load dashboard')}
          onRetry={() => refetchSummary()}
        />
      )}
      {tasksError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(tasksErr, 'Failed to load tasks')}
          onRetry={() => refetchTasks()}
        />
      )}
      {reviewError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(reviewErr, 'Failed to load review queue')}
          onRetry={() => refetchReview()}
        />
      )}
      {projectsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(projectsErr, 'Failed to load projects')}
          onRetry={() => refetchProjects()}
        />
      )}
      {attendanceError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(attendanceErr, 'Failed to load attendance')}
          onRetry={() => refetchAttendance()}
        />
      )}
      <Suspense fallback={null}>
        <MobileAttendanceBar />
      </Suspense>
      <div className="flex items-center justify-between gap-3 mb-3 -mt-1">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight truncate">
          Welcome, {user?.name || 'there'}
        </h1>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate(DASHBOARD_SETTINGS_PATH)}
          className="gap-1.5 shrink-0"
          aria-label="Customize dashboard layout"
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </div>
      <PinBoardProvider>
        <DashboardTierLayout
          elements={layoutElements}
          permissionPreset={permissionPreset}
          sectionState={dashboardPreset?.sectionState}
          renderWidget={renderComponent}
          workspaces={workspaces}
          tasks={tasks}
          projects={projects}
          tasksLoading={tasksLoading}
          onComplete={handleCompleteRequest}
          completingTaskId={completingTaskId}
        />
      </PinBoardProvider>

      <Suspense fallback={null}>
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
    </PageContainer>
  );
};

export default Dashboard;
