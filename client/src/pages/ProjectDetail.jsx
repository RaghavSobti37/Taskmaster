import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  List, 
  Columns, 
  ChartGantt, 
  Database, 
  Settings,
  Filter,
  Search,
  Plus,
  Users,
  ArrowLeft
} from 'lucide-react';
import ProjectList from '../components/project/ProjectList';
import ProjectKanban from '../components/project/ProjectKanban';
import ProjectGantt from '../components/project/ProjectGantt';
import ProjectTeam from '../components/project/ProjectTeam';
import { Badge, ProgressBar, NexusLoader, NexusDropdown } from '../components/ui';
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
    { id: 'gantt', icon: ChartGantt, label: 'Gantt Timeline' },
    { id: 'team', icon: Users, label: 'Project Team' },
    { id: 'assets', icon: Database, label: 'Assets' },
  ];

  if (loading) return <NexusLoader message="Loading project..." />;

  if (!project) return <div>Project not found.</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/50 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] transition-all"
              title="Back to Projects"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Project</span>
            <span className="w-1 h-1 bg-[var(--color-text-muted)] rounded-full" />
            <span className="text-[10px] font-black text-[var(--color-action-primary)] uppercase tracking-widest">{project._id.substring(0, 8).toUpperCase()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{project.name}</h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex-1 sm:flex-none p-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/50 rounded-xl text-[var(--color-text-muted)] transition-all flex items-center justify-center"
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={() => setIsTaskModalOpen(true)}
            className="flex-[3] sm:flex-none flex items-center justify-center gap-2 bg-[var(--color-action-primary)] text-white px-6 py-2.5 rounded-xl font-black text-xs md:text-sm hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} /> Add Task
          </button>
        </div>
      </header>

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

      {/* View Matrix Switcher */}
      <div className="flex flex-col space-y-4 border-b border-[var(--color-bg-border)] pb-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'assets') {
                  navigate('/assets');
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`
                flex items-center gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'text-[var(--color-action-primary)]' 
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}
              `}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-action-primary)]" 
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-1 focus:ring-[var(--color-action-primary)] outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
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
              className="min-w-[140px]"
            />
          </div>
        </div>
      </div>

      {/* Active View Container */}
      <div className="min-h-[500px]">
        {activeTab === 'list' && <ProjectList tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />}
        {activeTab === 'kanban' && <ProjectKanban tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />}
        {activeTab === 'gantt' && <ProjectGantt tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />}
        {activeTab === 'team' && <ProjectTeam project={project} onRemoveMember={handleRemoveMember} />}
      </div>
    </div>
  );
};

export default ProjectDetail;
