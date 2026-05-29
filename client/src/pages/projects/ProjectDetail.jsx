import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  List,
  Columns,
  Database,
  Settings,
  Filter,
  Search,
  Plus,
  Users,
  ArrowLeft,
  Layout,
  Calendar as CalendarIcon,
  ChevronRight,
  MoreVertical
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
  PageHeader, 
  TabSwitcher, 
  PageContainer,
  Button,
  Input,
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
import { format, addDays } from 'date-fns';
import { useToast } from '../../contexts/ToastContext';

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
  const { data: scheduleData } = useSchedule({
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
  const { addToast } = useToast();

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
    try {
      await axios.put(`/api/tasks/${task._id}`, { status: 'done', actualHours: (task.actualHours || 0) + hours });
      
      // Log to daily logs
      await axios.post('/api/logs', {
        action: 'TIME_LOG',
        targetType: 'Task',
        targetId: task._id,
        details: { hours, title: task.title }
      });
      
      addToast({
        title: 'Task Finished (+20 XP)',
        message: `Successfully completed "${task.title}" and logged ${hours}h. Exp awarded.`,
        type: 'success',
        duration: 6000
      });

      queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setTaskToComplete(null);
    } catch (err) {
      console.error('Task completion failed:', err);
      addToast({
        title: 'Completion Failed',
        message: err.response?.data?.error || 'Could not finish task.',
        type: 'error'
      });
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

  if (user?.role === 'admin' || user?.role === 'ops' || user?.role === 'operations' || user?.role === 'Operations') {
    tabs.push({ id: 'finance', label: 'Finance' });
  }

  if (loading && !project) return <PageSkeleton />;
  if (!project) return <div className="p-20 text-center">Project not found.</div>;

  return (
    <PageContainer className="!py-4 !space-y-4">
      {/* Header Matrix */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/projects')} className="!p-2">
            <ArrowLeft size={14} />
          </Button>
          <div className="flex flex-col" style={{ borderLeft: `3px solid ${getWorkspaceColor(project.workspace, workspaces)}`, paddingLeft: '10px' }}>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight uppercase">{project.name}</h1>
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                Project ID: {project._id.substring(0, 8)} • {project.progress}% Complete
              </span>
            </div>
        </div>

        <div className="flex items-center gap-2">
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
              className="w-40"
            />
          )}
          <Button variant="secondary" size="sm" onClick={() => setIsSettingsModalOpen(true)}>
            <Settings size={14} /> Settings
          </Button>
          <Button size="sm" onClick={() => setIsTaskModalOpen(true)}>
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
      <Card className="flex flex-col">
        <div className="p-2 border-b border-[var(--color-bg-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-bg-secondary)]">
          <TabSwitcher 
            tabs={tabs} 
            activeTab={activeTab} 
            onChange={setActiveTab} 
          />
          
          <div className="flex items-center gap-2 flex-1 min-w-[280px] justify-end">
            <Input 
              icon={Search} 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!py-1.5 !text-xs flex-1 max-w-md"
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
              className="w-36 shrink-0"
            />
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
              className="h-full"
            >
              {activeTab === 'list' && (
                <ProjectList tasks={displayTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />
              )}
              {activeTab === 'kanban' && (
                <ProjectKanban tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />
              )}
              {activeTab === 'schedule' && (
                <div className="p-4 space-y-4">
                  {hoursSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Task Hours</p><p className="text-2xl font-black">{hoursSummary.taskHours}h</p></Card>
                      <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Manual Logs</p><p className="text-2xl font-black">{hoursSummary.manualLogHours}h</p></Card>
                      <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Total</p><p className="text-2xl font-black">{hoursSummary.totalHours}h</p></Card>
                      <Card className="p-4"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Planned</p><p className="text-2xl font-black">{hoursSummary.plannedHours}h</p></Card>
                    </div>
                  )}
                  <ScheduleGrid data={scheduleData} projectId={id} compact onTaskClick={handleOpenDetail} />
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
