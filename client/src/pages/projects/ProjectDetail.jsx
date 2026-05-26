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
import { useProject, useProjectTasks, useUpdateTask, useDeleteTask } from '../../hooks/useTaskmasterQueries';

const ProjectDetail = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(id);
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const loading = projectLoading || tasksLoading;

  const [activeTab, setActiveTab] = useState('list');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCloseWarning, setShowCloseWarning] = useState(false);

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

  const handleTaskUpdate = (taskId, updates) => {
    updateTaskMutation.mutate({ id: taskId, data: updates });
    if (selectedTask?._id === taskId) {
      setSelectedTask(prev => ({ ...prev, ...updates }));
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
    { id: 'team', label: 'Team Members' },
    { id: 'assets', label: 'Project Files' },
  ];

  if (user?.role === 'admin' || user?.role === 'ops') {
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color || 'var(--color-action-primary)' }} />
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

      {/* Workspace Controls */}
      <Card className="flex flex-col">
        <div className="p-2 border-b border-[var(--color-bg-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-bg-secondary)]">
          <TabSwitcher 
            tabs={tabs} 
            activeTab={activeTab} 
            onChange={setActiveTab} 
          />
          
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Input 
              icon={Search} 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!py-1.5 !text-xs"
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
              className="w-32"
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
                <ProjectList tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />
              )}
              {activeTab === 'kanban' && (
                <ProjectKanban tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />
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
