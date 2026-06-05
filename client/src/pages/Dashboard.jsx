import React, { useMemo, Suspense, useState, useEffect, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/ui/primitives';
import MobileCollapsibleSection from '../components/ui/MobileCollapsibleSection';
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
const TaskCompletionModal = lazy(() => import('../components/TaskCompletionModal'));
const MobileAttendanceBar = lazy(() => import('../components/mobile/MobileAttendanceBar'));
import { useAttendanceCheck, useUndoAttendanceCheck, useAttendance } from '../hooks/useTaskmasterQueries';
import { formatDateKeyIST } from '../utils/attendanceUtils';
import { LAYOUT_TEMPLATES, canAccessComponent, getMobileWidgetOrder, isAnalyticsWidget } from '../lib/componentRegistry';
import { getLazyDashboardWidget } from '../lib/dashboardWidgetLoaders';
import { isAdminUser } from '../utils/departmentPermissions';
import { useIsMobile } from '../hooks/useBreakpoint';

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

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(queriesEnabled);
  const deferSecondaryQueries = queriesEnabled && !summaryLoading;
  const { data: tasks = [], isLoading: tasksLoading } = useDashboardTasks(user?._id, queriesEnabled);
  const { data: reviewTasks = [], isLoading: reviewLoading } = useReviewTasks(deferSecondaryQueries);
  const { data: projects = [], isLoading: projectsLoading } = useProjects(deferSecondaryQueries);
  const { data: workspaces = [] } = useWorkspaces(deferSecondaryQueries);
  const { data: dashboardPreset } = useDashboardPreset(queriesEnabled);
  const { data: users = [] } = useUserDirectory(deferSecondaryQueries);

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
  const { data: attendanceRows = [] } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();

  const executeAttendanceCheck = (type, manualTime, workMode) => {
    checkIn.mutate({ type, manualTime, workMode: workMode === 'wfh' ? 'wfh' : 'office' });
  };

  const calendar = useMemo(() => summary?.calendar || [], [summary]);

  const defaultElements = LAYOUT_TEMPLATES.find((t) => t.id === 'coreknot')?.elements || [];
  const elementsToRender = useMemo(
    () =>
      (dashboardPreset?.elements?.length ? dashboardPreset.elements : defaultElements).filter(
        (el) => el.visible !== false && canAccessComponent(el.componentId, permissionPreset)
      ),
    [dashboardPreset?.elements, defaultElements, permissionPreset]
  );
  const maxGridRow = useMemo(
    () => elementsToRender.reduce((max, el) => Math.max(max, el.row || 1), 1),
    [elementsToRender]
  );

  const isMobile = useIsMobile();

  const sortedElements = useMemo(() => {
    if (isMobile) {
      return [...elementsToRender].sort(
        (a, b) => getMobileWidgetOrder(a.componentId) - getMobileWidgetOrder(b.componentId)
      );
    }
    return [...elementsToRender].sort((a, b) => a.row - b.row || a.col - b.col);
  }, [elementsToRender, isMobile]);

  const primaryElements = useMemo(
    () =>
      isMobile
        ? sortedElements.filter(
            (el) => !isAnalyticsWidget(el.componentId) && el.componentId !== 'mark-attendance'
          )
        : sortedElements,
    [sortedElements, isMobile]
  );

  const analyticsElements = useMemo(
    () => (isMobile ? sortedElements.filter((el) => isAnalyticsWidget(el.componentId)) : []),
    [sortedElements, isMobile]
  );

  const [secondaryWidgetsReady, setSecondaryWidgetsReady] = useState(false);
  const [heavyWidgetsReady, setHeavyWidgetsReady] = useState(false);
  useEffect(() => {
    const enableSecondary = () => setSecondaryWidgetsReady(true);
    const enableHeavy = () => setHeavyWidgetsReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const secondaryId = window.requestIdleCallback(enableSecondary, { timeout: 1500 });
      const heavyId = window.requestIdleCallback(enableHeavy, { timeout: 3500 });
      return () => {
        window.cancelIdleCallback(secondaryId);
        window.cancelIdleCallback(heavyId);
      };
    }
    const secondaryTimer = window.setTimeout(enableSecondary, 300);
    const heavyTimer = window.setTimeout(enableHeavy, 800);
    return () => {
      window.clearTimeout(secondaryTimer);
      window.clearTimeout(heavyTimer);
    };
  }, []);

  const renderWidget = (el) => {
    const span = parseInt(el.size, 10) || 1;
    return (
      <div
        key={el.componentId}
        className="flex flex-col min-h-0 dashboard-grid-item max-lg:min-h-0"
        style={{ '--lg-col': el.col, '--lg-row': el.row, '--lg-span': span }}
      >
        {renderComponent(el.componentId)}
      </div>
    );
  };

  const renderComponent = (componentId) => {
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
        return renderLazyWidget(componentId, { componentId });
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
      <Suspense fallback={null}>
        <MobileAttendanceBar />
      </Suspense>
      <PinBoardProvider>
        <div
          className="dashboard-widget-grid grid grid-cols-1 lg:grid-cols-4 gap-0 lg:gap-0 gap-3 grid-flow-row-dense auto-rows-max"
          style={{ '--grid-rows': maxGridRow }}
        >
          {primaryElements.map(renderWidget)}
          {isMobile && analyticsElements.length > 0 && (
            <MobileCollapsibleSection title="Insights" className="col-span-1">
              <div className="space-y-3">
                {analyticsElements.map(renderWidget)}
              </div>
            </MobileCollapsibleSection>
          )}
        </div>
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
