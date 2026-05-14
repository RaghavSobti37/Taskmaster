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
  Calendar as CalendarIcon
} from 'lucide-react';
import ProjectList from '../components/project/ProjectList';
import ProjectKanban from '../components/project/ProjectKanban';
import ProjectTeam from '../components/project/ProjectTeam';
import ProjectCalendar from '../components/project/ProjectCalendar';
import { Badge, ProgressBar, NexusLoader, NexusDropdown, PageHeader, TabSwitcher, PageContainer } from '../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import TaskCreateModal from '../components/TaskCreateModal';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import TaskDetailModal from '../components/TaskDetailModal';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTableTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, tasksRes] = await Promise.all([
          axios.get(`/api/projects/${id}`),
          axios.get(`/api/tasks?projectId=${id}`)
        ]);
        setProject(projRes.data);
        setTableTasks(tasksRes.data);
      } catch (err) {
        console.error('Error fetching project data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleTaskCreated = (newTask) => {
    setTableTasks([newTask, ...tasks]);
  };

  const handleTaskUpdate = async (taskId, updates) => {
    const originalTasks = [...tasks];
    // Optimistic Update
    const optimisticTasks = tasks.map(t => t._id === taskId ? { ...t, ...updates } : t);
    setTableTasks(optimisticTasks);

    try {
      const res = await axios.put(`/api/tasks/${taskId}`, updates);
      // Sync with server response
      setTableTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
      if (selectedTask?._id === taskId) setSelectedTask(res.data);
    } catch (err) {
      console.error('Error updating task:', err);
      // Rollback on failure
      setTableTasks(originalTasks);
    }
  };

  const handleTaskDelete = (taskId) => {
    setTableTasks(tasks.filter(t => t._id !== taskId));
  };

  const handleOpenDetail = (task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await axios.put(`/api/projects/${id}/remove-member`, { userId });
      setProject(res.data);
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const tabs = [
    { id: 'list', icon: List, label: 'List View' },
    { id: 'kanban', icon: Columns, label: 'Kanban Board' },
    { id: 'team', icon: Users, label: 'Project Team' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'assets', icon: Database, label: 'Assets' },
  ];

  const ProjectSkeleton = () => (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-3 w-full sm:w-auto">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-10 w-full sm:w-64 bg-slate-200 rounded-xl" />
        </div>
        <div className="flex gap-3 w-full sm:w-auto justify-end">
          <div className="h-10 w-10 bg-slate-200 rounded-xl" />
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>
      <div className="h-12 w-full bg-slate-100 rounded-xl" />
      <div className="h-[500px] bg-slate-100 rounded-[2.5rem]" />
    </div>
  );

  if (loading && !project) return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
      <ProjectSkeleton />
    </div>
  );

  if (!project) return <div>Project not found.</div>;

  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-160px)] lg:h-[calc(100vh-120px)] flex flex-col overflow-hidden px-4 md:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex-shrink-0 space-y-6 pt-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => navigate('/projects')}
              className="group flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl hover:border-[var(--color-action-primary)] hover:bg-[var(--color-action-primary)]/5 transition-all shadow-sm"
              aria-label="Back to Projects"
            >
              <ArrowLeft size={18} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-[clamp(1.1rem,5vw,1.5rem)] font-black text-[var(--color-text-primary)] uppercase tracking-tight truncate leading-tight">
                {project.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Project</span>
                <div className="w-1 h-1 rounded-full bg-[var(--color-bg-border)]" />
                <span className="text-[8px] font-black text-[var(--color-action-primary)] uppercase tracking-[0.2em]">{project._id.substring(0, 8)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex-shrink-0 p-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] hover:border-[var(--color-action-primary)]/30 transition-all shadow-sm"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={14} strokeWidth={3} /> <span className="sm:inline">Add Task</span>
            </button>
          </div>
        </div>

      </motion.div>

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
        onProjectUpdated={setProject}
      />

      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        onTaskUpdated={handleTaskUpdate}
        onTaskDeleted={handleTaskDelete}
      />

      {/* View Matrix Switcher & Controls */}
      <div className="flex-shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[var(--color-bg-border)] pb-4 mb-6">
        <div className="w-full xl:w-auto overflow-x-auto custom-scrollbar-hide -mx-4 px-4 xl:mx-0 xl:px-0">
          <TabSwitcher
            activeTab={activeTab}
            onChange={(id) => id === 'assets' ? navigate('/assets') : setActiveTab(id)}
            tabs={tabs}
            className="bg-transparent border-none shadow-none !p-0 min-w-max"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          <div className="relative flex-1 sm:min-w-[200px] xl:min-w-[240px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase tracking-tight focus:ring-1 focus:ring-[var(--color-action-primary)] outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <NexusDropdown
              options={[
                { value: 'all', label: 'ALL STATUS' },
                { value: 'todo', label: 'TODO' },
                { value: 'in-progress', label: 'IN PROGRESS' },
                { value: 'in-review', label: 'IN REVIEW' },
                { value: 'done', label: 'COMPLETED' },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              variant="compact"
              className="flex-1 sm:min-w-[130px]"
            />
          </div>
        </div>
      </div>

      {/* Active View Container */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex-1 min-h-0 overflow-hidden"
      >
        <div className="h-full">
          {activeTab === 'list' && (
            <div className="h-full overflow-y-auto custom-scrollbar pr-2">
              <ProjectList tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />
            </div>
          )}
          {activeTab === 'kanban' && (
            <div className="h-full">
              <ProjectKanban tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />
            </div>
          )}
          {activeTab === 'team' && (
            <div className="h-full overflow-y-auto custom-scrollbar pr-2">
              <ProjectTeam project={project} onRemoveMember={handleRemoveMember} />
            </div>
          )}
          {activeTab === 'calendar' && (
            <div className="h-full overflow-hidden">
              <ProjectCalendar projectId={id} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ProjectDetail;
