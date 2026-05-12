import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  List, 
  Columns, 
  ChartGantt, 
  PieChart, 
  Settings,
  Filter,
  Search,
  Plus,
  Users
} from 'lucide-react';
import ProjectList from '../components/project/ProjectList';
import ProjectKanban from '../components/project/ProjectKanban';
import ProjectGantt from '../components/project/ProjectGantt';
import ProjectTeam from '../components/project/ProjectTeam';
import { Badge, ProgressBar } from '../components/ui';
import TaskCreateModal from '../components/TaskCreateModal';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import TaskDetailModal from '../components/TaskDetailModal';

const ProjectDetail = () => {
  const { id } = useParams();
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

  const tabs = [
    { id: 'list', icon: List, label: 'List View' },
    { id: 'kanban', icon: Columns, label: 'Kanban Board' },
    { id: 'gantt', icon: ChartGantt, label: 'Gantt Timeline' },
    { id: 'team', icon: Users, label: 'Project Team' },
    { id: 'resources', icon: PieChart, label: 'Utilization' },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <div className="w-12 h-12 border-4 border-[var(--color-action-primary)] border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--color-text-muted)] font-medium">Loading project...</p>
    </div>
  );

  if (!project) return <div>Project not found.</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Project</span>
            <span className="w-1 h-1 bg-[var(--color-text-muted)] rounded-full" />
            <span className="text-xs font-bold text-[var(--color-action-primary)]">{project._id.substring(0, 8).toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2.5 hover:bg-[var(--color-bg-border)] rounded-xl text-[var(--color-text-muted)] transition-all"
          >
            <Settings size={22} />
          </button>
          <button 
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all"
          >
            <Plus size={20} /> Add Task
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
      <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-px">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all relative whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'text-[var(--color-action-primary)]' 
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}
              `}
            >
              <tab.icon size={18} />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-action-primary)]" />
              )}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-transparent border border-[var(--color-bg-border)] rounded-xl text-sm focus:ring-1 focus:ring-[var(--color-action-primary)] outline-none"
            />
          </div>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-bg-border)] rounded-xl text-sm font-medium hover:bg-[var(--color-bg-border)] transition-all bg-transparent outline-none"
          >
            <option value="all">ALL STATUS</option>
            <option value="todo">TODO</option>
            <option value="in-progress">IN PROGRESS</option>
            <option value="in-review">IN REVIEW</option>
            <option value="done">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Active View Container */}
      <div className="min-h-[500px]">
        {activeTab === 'list' && <ProjectList tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />}
        {activeTab === 'kanban' && <ProjectKanban tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />}
        {activeTab === 'gantt' && <ProjectGantt tasks={filteredTasks} onUpdate={handleTaskUpdate} onDetail={handleOpenDetail} />}
        {activeTab === 'team' && <ProjectTeam project={project} />}
        {activeTab === 'resources' && <div className="p-20 text-center bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] text-[var(--color-text-muted)] italic">Resource tracking coming soon.</div>}
      </div>
    </div>
  );
};

export default ProjectDetail;
