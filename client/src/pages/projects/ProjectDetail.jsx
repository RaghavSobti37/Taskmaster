import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Settings,
  Plus,
  ArrowLeft,
  Layout,
} from 'lucide-react';
import ProjectList from '../../components/project/ProjectList';
import ProjectKanban from '../../components/project/ProjectKanban';
import ProjectTeam from '../../components/project/ProjectTeam';
import ProjectAssets from '../../components/project/ProjectAssets';
import ProjectFinance from '../../components/project/ProjectFinance';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Badge, 
  ProgressBar, 
  PageSkeleton, 
  NexusDropdown, 
  TabSwitcher, 
  PageContainer,
  Button,
  SearchInput,
  Card,
  NexusModal
} from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import TaskCreateModal from '../../components/TaskCreateModal';
import ProjectSettingsModal from '../../components/ProjectSettingsModal';
import { useQueryClient } from '@tanstack/react-query';
import TaskDetailModal from '../../components/TaskDetailModal';
import TaskCompletionModal from '../../components/TaskCompletionModal';
import { useProject, useProjectTasks, useUpdateTask, useDeleteTask, useSchedule, useProjectHoursSummary, useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import ScheduleSkeleton from '../../components/schedule/ScheduleSkeleton';
import { format, addDays } from 'date-fns';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../../lib/notifications';
import { buildTaskCompletionLogPayload, shouldClientCreateCompletionLog, taskCompletionToast } from '../../utils/taskCompletion';
import { updateAllTaskQueries } from '../../utils/taskCache';
import { formatHoursMinutes } from '../../utils/formatHours';
import { isOpsUser } from '../../utils/departmentPermissions';

const ProjectDetail = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(id);
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const [activeTab, setActiveTab] = useState('list');
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    projectId: id
  }, activeTab === 'schedule');
  const { data: hoursSummary } = useProjectHoursSummary(id, activeTab === 'schedule' || activeTab === 'finance');
  const loading = projectLoading || tasksLoading;
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState(null);
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

  const displayTasks = React.useMemo(() => {
    const active = filteredTasks.filter((t) => t.status !== 'done');
    const completed = filteredTasks.filter((t) => t.status === 'done');
    return [...active, ...completed];
  }, [filteredTasks]);

  const handleTaskCreated = () => {};

  const handleTaskUpdate = (taskId, updates) => {
    if (updates.status === 'done') {
      const task = tasks.find(t => t._id === taskId);
      if (task) {
        setTaskToComplete(task);
        return;
      }
    }
    updateTaskMutation.mutate({ id: taskId, data: updates });
    if (selectedTask?._id === taskId) {
      setSelectedTask(prev => ({ ...prev, ...updates }));
    }
  };

  const handleCompleteTaskSubmit = async (task, hours) => {
    suppressAutoToasts(5000);
    setCompletingTaskId(task._id);
    setTaskToComplete(null);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${task._id}`,
        { status: 'done', actualHours: (task.actualHours || 0) + hours },
        AXIOS_SKIP_TOAST
      );
      if (shouldClientCreateCompletionLog(taskRes.data?.status)) {
        axios.post(
          '/api/logs',
          buildTaskCompletionLogPayload(task, hours, project ? [project] : []),
          AXIOS_SKIP_TOAST
        ).catch(() => {});
      }

      addToast({
        ...taskCompletionToast(taskRes.data?.status, task.title),
        duration: 6000,
        module: MODULE.PROJECTS,
      });

      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) => (t._id === task._id ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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

  const tabs = [
    { id: 'list', label: 'Task List' },
    { id: 'kanban', label: 'Kanban Board' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'team', label: 'Team Members' },
    { id: 'assets', label: 'Project Files' },
  ];

  if (isOpsUser(user)) {
    tabs.push({ id: 'finance', label: 'Finance' });
  }

  const showTaskFilters = activeTab === 'list' || activeTab === 'kanban';

  if (loading && !project) return <PageSkeleton />;
  if (!project) return <div className="p-20 text-center">Project not found.</div>;

  return (
    <PageContainer className="!py-4 !space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="secondary" size="sm" onClick={() => navigate('/projects')} className="!p-2 shrink-0">
            <ArrowLeft size={14} />
          </Button>
          <div
            className="flex flex-col min-w-0 pl-2.5 border-l-[3px]"
            style={{ borderLeftColor: getWorkspaceColor(project.workspace, workspaces) }}
          >
            <h1 className="text-lg font-bold tracking-tight uppercase truncate">{project.name}</h1>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              Project ID: {project._id.substring(0, 8)} • {project.progress}% Complete
            </span>
          </div>
        </div>

        <div className="flex flex-nowrap items-center gap-2 min-w-0 overflow-x-auto">
          {project.status === 'active' && (
            <NexusDropdown
              variant="compact"
              options={[
                { value: 'archive', label: 'Archive Project' },
                { value: 'close', label: 'Close Project (Gain XP)' }
              ]}
              value=""
              placeholder="Actions"
              onChange={(val) => {
                if (val === 'archive') handleUpdateProjectStatus('archived');
                if (val === 'close') setShowCloseWarning(true);
              }}
              className="w-[9.5rem] shrink-0"
            />
          )}
          <Button variant="secondary" size="sm" onClick={() => setIsSettingsModalOpen(true)} className="shrink-0">
            <Settings size={14} /> Settings
          </Button>
          <Button size="sm" onClick={() => setIsTaskModalOpen(true)} className="shrink-0">
            <Plus size={14} /> Add Task
          </Button>
        </div>
      </div>

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
        onTaskUpdated={handleTaskUpdate}
        onTaskDeleted={handleTaskDelete}
      />

      <TaskCompletionModal 
        task={taskToComplete}
        isOpen={!!taskToComplete}
        onClose={() => setTaskToComplete(null)}
        onSubmit={handleCompleteTaskSubmit}
      />

      {/* Workspace Controls */}
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex-1 min-w-0 overflow-x-auto">
              <TabSwitcher
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
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

        <div className="p-0 min-h-fit">
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
                <ProjectList tasks={displayTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} completingTaskId={completingTaskId} />
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Task Hours</p><p className="text-2xl font-black">{formatHoursMinutes(hoursSummary.taskHours)}</p></Card>
                          <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Manual Logs</p><p className="text-2xl font-black">{formatHoursMinutes(hoursSummary.manualLogHours)}</p></Card>
                          <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Total</p><p className="text-2xl font-black">{formatHoursMinutes(hoursSummary.totalHours)}</p></Card>
                          <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Planned</p><p className="text-2xl font-black">{formatHoursMinutes(hoursSummary.plannedHours)}</p></Card>
                        </div>
                      )}
                      <ScheduleGrid data={scheduleData} projectId={id} compact onTaskClick={handleOpenDetail} />
                    </>
                  )}
                </div>
              )}
              {activeTab === 'team' && (
                <ProjectTeam project={project} onRemoveMember={handleRemoveMember} />
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
      </Card>
    </PageContainer>
  );
};

export default ProjectDetail;
