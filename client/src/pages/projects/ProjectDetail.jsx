import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Settings,
  Plus,
  ArrowLeft,
  Layout,
  BarChart3,
} from 'lucide-react';
import ProjectList from '../../components/project/ProjectList';
import ProjectKanban from '../../components/project/ProjectKanban';
import ProjectTeam from '../../components/project/ProjectTeam';
import ProjectAssets from '../../components/project/ProjectAssets';
import ProjectFinance from '../../components/project/ProjectFinance';
import ProjectGoalsPanel from '../../components/project/ProjectGoalsPanel';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, ProgressBar, PageSkeleton, NexusDropdown, TabSwitcher, PageContainer, PageHeader, Button, SearchInput } from '../../components/ui';
import { NexusModal } from '../../components/ui/modals';;
import { motion, AnimatePresence } from 'framer-motion';
import TaskCreateModal from '../../components/TaskCreateModal';
import ProjectSettingsModal from '../../components/ProjectSettingsModal';
import { useQueryClient } from '@tanstack/react-query';
import TaskDetailModal from '../../components/TaskDetailModal';
import TaskCompletionModal from '../../components/TaskCompletionModal';
import { useProject, useProjectTasks, useUpdateTask, useDeleteTask, useSchedule, useProjectHoursSummary, useWorkspaces, useUserDirectory, useReviewTasks } from '../../hooks/useTaskmasterQueries';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import ScheduleSkeleton from '../../components/schedule/ScheduleSkeleton';
import { format, addDays } from 'date-fns';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../../lib/notifications';
import {
  taskCompletionToast,
  taskApprovalToast,
  resolveTaskId,
  normalizeCompletionHours,
} from '../../utils/taskCompletion';
import { resolveTaskFinishFlow } from '../../utils/taskFinishFlow';
import { updateAllTaskQueries } from '../../utils/taskCache';
import { formatHoursMinutes } from '../../utils/formatHours';
import { isOpsUser } from '../../utils/departmentPermissions';
import { computeTaskIndicators } from '../../utils/taskIndicators';
import { countReviewTasksByProject } from '../../utils/taskReview';

const ProjectDetail = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: workspaces = [] } = useWorkspaces();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const includeOldCompleted = filterStatus === 'done' || searchTerm.trim().length > 0;
  const [completedPage, setCompletedPage] = useState(1);
  const [completedPageSize, setCompletedPageSize] = useState(5);

  useEffect(() => {
    setCompletedPage(1);
  }, [id, includeOldCompleted, searchTerm, filterStatus]);

  const { data: projectTasksData, isLoading: tasksLoading } = useProjectTasks(id, {
    includeOldCompleted,
    completedPage: includeOldCompleted ? 1 : completedPage,
    completedLimit: includeOldCompleted ? 200 : completedPageSize,
  });
  const tasks = projectTasksData?.tasks ?? [];
  const completedTotal = projectTasksData?.completedTotal ?? tasks.filter((t) => t.status === 'done').length;
  const completedTotalPages = includeOldCompleted
    ? 1
    : (projectTasksData?.completedPages ?? Math.max(1, Math.ceil(completedTotal / completedPageSize)));
  const { data: reviewTasks = [] } = useReviewTasks(!!user?._id);
  const projectReviewCount = useMemo(
    () => countReviewTasksByProject(reviewTasks)[String(id)] || 0,
    [reviewTasks, id]
  );
  const taskIndicators = useMemo(() => computeTaskIndicators(tasks), [tasks]);
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    if (location.state?.tab === 'analytics') {
      navigate(`/projects/${id}/analytics`, { replace: true, state: {} });
    } else if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab, id, navigate]);
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    projectId: id
  }, activeTab === 'schedule');
  const { data: hoursSummary } = useProjectHoursSummary(id, activeTab === 'schedule' || activeTab === 'finance');
  const { data: users = [] } = useUserDirectory();
  const loading = projectLoading || tasksLoading;
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [taskToApprove, setTaskToApprove] = useState(null);
  const [completionSubmitForReview, setCompletionSubmitForReview] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const { addToast } = useSystemToast();

  const handleUpdateProjectStatus = async (status) => {
    try {
      await axios.put(`/api/projects/${id}`, { status });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (status === 'completed' || status === 'archived') {
        navigate('/projects');
      }
    } catch (err) {
      console.error('Failed to update project status:', err);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleTaskCreated = () => {};

  const findTaskById = (taskId) =>
    tasks.find((t) => resolveTaskId(t) === String(taskId));

  const handleCompleteRequest = (task) => {
    const flow = resolveTaskFinishFlow(task, user, project ? [project] : [], users);
    if (flow.blocked) {
      if (flow.toast) addToast({ ...flow.toast, module: MODULE.PROJECTS });
      return;
    }
    if (flow.action === 'approve') {
      setTaskToApprove(flow.task);
      return;
    }
    setCompletionSubmitForReview(!!flow.submitForReview);
    setTaskToComplete(flow.task);
  };

  const handleTaskUpdate = (taskId, updates) => {
    if (updates.status === 'done') {
      const task = findTaskById(taskId);
      if (!task) return;
      handleCompleteRequest(task);
      return;
    }

    const existing = findTaskById(taskId);
    if (existing?.status === 'done') {
      handleOpenDetail(existing);
      return;
    }

    updateTaskMutation.mutate({ id: taskId, data: updates });
    if (resolveTaskId(selectedTask) === String(taskId)) {
      setSelectedTask((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  const handleApproveReview = async (task, reviewHours) => {
    const taskId = resolveTaskId(task);
    if (!taskId) return;
    suppressAutoToasts(5000);
    setCompletingTaskId(taskId);
    setTaskToApprove(null);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${taskId}`,
        { reviewAction: 'approve', reviewHours },
        AXIOS_SKIP_TOAST
      );
      addToast({
        ...taskApprovalToast(task.title),
        duration: 6000,
        module: MODULE.PROJECTS,
      });
      updateAllTaskQueries(queryClient, (list) =>
        (list || []).map((t) => (resolveTaskId(t) === taskId ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['tasks', 'review'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      if (selectedTask?._id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, ...taskRes.data } : prev));
      }
    } catch (err) {
      addToast({
        title: 'Approval Failed',
        message: err.response?.data?.error || err.response?.data?.message || 'Could not approve task.',
        type: 'error',
        module: MODULE.PROJECTS,
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleCompleteTaskSubmit = async (task, hours) => {
    const taskId = resolveTaskId(task);
    if (!taskId) return;
    suppressAutoToasts(5000);
    setCompletingTaskId(taskId);
    setTaskToComplete(null);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${taskId}`,
        { status: 'done', actualHours: normalizeCompletionHours(task.actualHours, hours) },
        AXIOS_SKIP_TOAST
      );
      addToast({
        ...taskCompletionToast(taskRes.data?.status, task.title),
        duration: 6000,
        module: MODULE.PROJECTS,
      });

      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) => (resolveTaskId(t) === resolveTaskId(task) ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', { projectId: id }] });
      setIsDetailModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('Task completion failed:', err);
      addToast({
        title: 'Completion Failed',
        message: err.response?.data?.error || 'Could not finish task.',
        type: 'error',
        module: MODULE.PROJECTS,
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleTaskDelete = (taskId) => {
    deleteTaskMutation.mutate(taskId);
    if (selectedTask?._id === taskId) {
      setIsDetailModalOpen(false);
    }
  };

  const handleOpenDetail = (task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleRemoveMember = async (userId) => {
    try {
      await axios.put(`/api/projects/${id}/remove-member`, { userId });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const scheduleTaskCount = scheduleData?.tasks?.length ?? 0;

  const tabs = useMemo(() => {
    const base = [
      { id: 'list', label: 'Task List', badge: taskIndicators.open, badgeVariant: taskIndicators.overdue > 0 ? 'overdue' : undefined },
      { id: 'kanban', label: 'Kanban Board', badge: taskIndicators.open },
      { id: 'schedule', label: 'Schedule', badge: scheduleTaskCount },
      { id: 'team', label: 'Team Members', badge: project?.members?.length ?? 0 },
      { id: 'goals', label: 'Goals' },
      { id: 'assets', label: 'Project Files' },
    ];
    if (projectReviewCount > 0) {
      base[0] = { ...base[0], badge: projectReviewCount, badgeVariant: 'warning' };
    }
    if (isOpsUser(user)) {
      base.push({ id: 'finance', label: 'Finance' });
    }
    return base;
  }, [taskIndicators, scheduleTaskCount, project?.members?.length, projectReviewCount, user]);

  const showTaskFilters = activeTab === 'list' || activeTab === 'kanban';

  if (loading && !project) return <PageSkeleton />;
  if (!project) return <div className="p-20 text-center">Project not found.</div>;

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        icon={Layout}
        title={project.name}
        leadingActions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/projects')} className="!p-2 shrink-0">
            <ArrowLeft size={14} />
          </Button>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
            {project.status === 'active' && (
              <NexusDropdown
                variant="compact"
                options={[
                  { value: 'archive', label: 'Archive Project' },
                  { value: 'close', label: 'Close Project (Gain XP)' }
                ]}
                value=""
                placeholder="Project"
                onChange={(val) => {
                  if (val === 'archive') handleUpdateProjectStatus('archived');
                  if (val === 'close') setShowCloseWarning(true);
                }}
                className="w-full sm:w-[9.5rem]"
              />
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${id}/analytics`)}>
              <BarChart3 size={14} /> Analytics
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsSettingsModalOpen(true)}>
              <Settings size={14} /> Settings
            </Button>
            <Button size="sm" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={14} /> Add Task
            </Button>
          </div>
        }
      >
        <div
          className="h-1 w-16 rounded-full mt-1"
          style={{ backgroundColor: getWorkspaceColor(project.workspace, workspaces) }}
          aria-hidden
        />
      </PageHeader>

      <NexusModal
        isOpen={showCloseWarning}
        onClose={() => setShowCloseWarning(false)}
        title="Close Project & Award XP"
        message="Closing this project will award +500 XP to all team members and automatically mark all pending tasks as Done. Proceed?"
        type="success"
        isConfirm
        confirmLabel="Close Project"
        onConfirm={() => {
          setShowCloseWarning(false);
          handleUpdateProjectStatus('completed');
        }}
      />

      <TaskCreateModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={id}
        members={project.members}
        onTaskCreated={handleTaskCreated}
      />

      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={project}
        onProjectUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['projects', id] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
      />

      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        onTaskUpdated={(updated) => {
          if (updated) setSelectedTask((prev) => (prev ? { ...prev, ...updated } : prev));
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
        onTaskDeleted={handleTaskDelete}
        onFinishRequest={handleCompleteRequest}
      />

      <TaskCompletionModal 
        task={taskToComplete}
        isOpen={!!taskToComplete}
        onClose={() => setTaskToComplete(null)}
        onSubmit={handleCompleteTaskSubmit}
        submitForReview={completionSubmitForReview}
      />
      <TaskCompletionModal
        task={taskToApprove}
        isOpen={!!taskToApprove}
        onClose={() => setTaskToApprove(null)}
        onSubmit={handleApproveReview}
        approveReview
      />

      <div className="border-b border-[var(--color-bg-border)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <TabSwitcher
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="!bg-transparent !border-0 !p-0"
            />
          </div>

          {showTaskFilters && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
              <SearchInput
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-w-0 w-full sm:w-52 shrink"
              />
              <NexusDropdown
                variant="compact"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'todo', label: 'Todo' },
                  { value: 'in-progress', label: 'Active' },
                  { value: 'done', label: 'Done' },
                ]}
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="Status"
                className="w-full sm:w-[9.5rem] shrink-0"
              />
            </div>
          )}
        </div>
      </div>

      <div className="min-h-fit">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={activeTab === 'team' || activeTab === 'assets' ? 'w-full' : 'h-full'}
            >
              {activeTab === 'list' && (
                <ProjectList
                  tasks={filteredTasks}
                  onUpdate={handleTaskUpdate}
                  onCompleteRequest={handleCompleteRequest}
                  onDetail={handleOpenDetail}
                  completingTaskId={completingTaskId}
                  completedTotal={completedTotal}
                  completedPage={completedPage}
                  completedPageSize={completedPageSize}
                  completedTotalPages={completedTotalPages}
                  onCompletedPageChange={setCompletedPage}
                  onCompletedPageSizeChange={(size) => {
                    setCompletedPageSize(size);
                    setCompletedPage(1);
                  }}
                  serverCompletedPagination={!includeOldCompleted}
                />
              )}
              {activeTab === 'kanban' && (
                <ProjectKanban tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} completingTaskId={completingTaskId} />
              )}
              {activeTab === 'schedule' && (
                <div className="p-4 space-y-4">
                  {scheduleLoading ? (
                    <ScheduleSkeleton compact showStatCards departmentCount={1} />
                  ) : (
                    <>
                      {hoursSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-[var(--color-bg-border)] pb-4">
                          {[
                            { label: 'Task Hours', value: formatHoursMinutes(hoursSummary.taskHours) },
                            { label: 'Manual Logs', value: formatHoursMinutes(hoursSummary.manualLogHours) },
                            { label: 'Total', value: formatHoursMinutes(hoursSummary.totalHours) },
                            { label: 'Planned', value: formatHoursMinutes(hoursSummary.plannedHours) },
                          ].map((stat) => (
                            <div key={stat.label} className="py-2">
                              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">{stat.label}</p>
                              <p className="text-2xl font-black tabular-nums mt-1">{stat.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <ScheduleGrid
                        data={scheduleData}
                        workspaces={workspaces}
                        projects={project ? [project] : []}
                        compact
                        onTaskClick={handleOpenDetail}
                      />
                    </>
                  )}
                </div>
              )}
              {activeTab === 'team' && (
                <ProjectTeam project={project} onRemoveMember={handleRemoveMember} />
              )}
              {activeTab === 'goals' && (
                <ProjectGoalsPanel projectId={id} project={project} />
              )}
              {activeTab === 'assets' && (
                <ProjectAssets projectId={id} />
              )}
              {activeTab === 'finance' && (
                <ProjectFinance projectId={id} />
              )}
            </motion.div>
          </AnimatePresence>
      </div>
    </PageContainer>
  );
};

export default ProjectDetail;


// Performance Optimization: useCallback(eventHandler) memoization guard
