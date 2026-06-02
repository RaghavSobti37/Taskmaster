import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, DashboardSkeleton } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';
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
import {
  AnnouncementsCard,
  CalendarTodayCard,
  TodosTodayCard,
  TodosOverdueCard,
  ReviewQueueCard,
  ProjectsTodayCard,
  NotesPanel,
  PinBoardMessages,
  PinBoardComposer,
  LeaderboardPodium,
  DailyMissionsCard,
  PipelineSummaryCard,
  GenericDashboardCard,
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useSystemToast();
  const permissionPreset = useMemo(() => {
    if (isAdminUser(user)) return 'admin';
    const dept = user?.departmentId;
    return dept?.permissionPreset || dept?.slug || 'standard';
  }, [user]);

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useDashboardTasks(user?._id);
  const { data: reviewTasks = [], isLoading: reviewLoading } = useReviewTasks(!!user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: dashboardPreset, isLoading: presetLoading } = useDashboardPreset();
  const { data: users = [] } = useUserDirectory();

  const {
    taskToComplete,
    setTaskToComplete,
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
  const [isLocating, setIsLocating] = useState(false);

  const executeGeolocationCheck = (type, manualTime) => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkIn.mutate(
            { type, lat: position.coords.latitude, lng: position.coords.longitude, manualTime },
            { onSettled: () => setIsLocating(false) }
          );
        },
        () => {
          addToast({
            type: 'warn',
            message: 'Location unavailable — check-in saved without GPS.',
            module: MODULE.ATTENDANCE,
          });
          checkIn.mutate({ type, manualTime }, { onSettled: () => setIsLocating(false) });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      addToast({
        type: 'warn',
        message: 'Location unavailable — check-in saved without GPS.',
        module: MODULE.ATTENDANCE,
      });
      checkIn.mutate({ type, manualTime }, { onSettled: () => setIsLocating(false) });
    }
  };

  const calendar = useMemo(() => summary?.calendar || [], [summary]);
  const showPageSkeleton = presetLoading && !dashboardPreset;

  const defaultElements = LAYOUT_TEMPLATES.find((t) => t.id === 'coreknot')?.elements || [];
  const elementsToRender = useMemo(
    () =>
      (dashboardPreset?.elements?.length ? dashboardPreset.elements : defaultElements).filter(
        (el) => el.visible && canAccessComponent(el.componentId, permissionPreset)
      ),
    [dashboardPreset?.elements, defaultElements, permissionPreset]
  );
  const maxGridRow = useMemo(
    () => elementsToRender.reduce((max, el) => Math.max(max, el.row || 1), 1),
    [elementsToRender]
  );

  if (showPageSkeleton) {
    return (
      <PageContainer>
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  const renderComponent = (componentId) => {
    switch (componentId) {
      case 'leaderboard':
        return <LeaderboardPodium />;
      case 'daily-missions':
        return <DailyMissionsCard />;
      case 'announcements':
        return <AnnouncementsCard />;
      case 'pinboard':
        return <PinBoardMessages />;
      case 'schedule':
        return <CalendarTodayCard calendar={calendar} loading={summaryLoading} />;
      case 'review-queue':
        return (
          <ReviewQueueCard
            tasks={reviewTasks}
            projects={projects}
            workspaces={workspaces}
            loading={reviewLoading}
            onApprove={handleApproveReview}
            approvingTaskId={approvingReviewId}
            onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
          />
        );
      case 'todos-today':
        return (
          <TodosTodayCard
            tasks={tasks}
            projects={projects}
            loading={tasksLoading}
            onComplete={handleCompleteRequest}
            completingTaskId={completingTaskId}
          />
        );
      case 'todos-overdue':
        return (
          <TodosOverdueCard
            tasks={tasks}
            projects={projects}
            loading={tasksLoading}
            onComplete={handleCompleteRequest}
            completingTaskId={completingTaskId}
          />
        );
      case 'projects-today':
        return <ProjectsTodayCard tasks={tasks} projects={projects} loading={tasksLoading || projectsLoading} />;
      case 'notes':
        return <NotesPanel />;
      case 'composer':
        return <PinBoardComposer />;
      case 'mark-attendance':
        return (
          <UnifiedTimeCard
            entry={attendanceRows[0]}
            title={format(today, 'EEEE, MMMM d')}
            subTitle="Today"
            isSelfMode
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
      default:
        return null;
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
            .sort((a, b) => a.row - b.row || a.col - b.col)
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
