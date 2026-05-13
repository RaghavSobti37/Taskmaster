import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Database,
  Calendar as CalIcon,
  Briefcase,
  ChevronRight,
  Filter,
  ArrowUpRight,
  RotateCcw,
  X,
  Plus
} from 'lucide-react';
import axios from 'axios';
import { Badge, ProgressBar } from '../components/ui';
import TaskCreateModal from '../components/TaskCreateModal';
import { format, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ icon: Icon, label, value, color, delay, isActive, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    onClick={onClick}
    className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${isActive
      ? 'bg-[var(--color-bg-surface)] border-[var(--color-action-primary)] ring-2 ring-[var(--color-action-primary)]/20'
      : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)]'
      }`}
  >
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      </div>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ done: 0, progress: 0, todo: 0, review: 0 });
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [undoTask, setUndoTask] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const undoTimer = useRef(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [tasksRes, logsRes, projectsRes, teamRes] = await Promise.all([
        axios.get('/api/tasks'),
        axios.get('/api/logs'),
        axios.get('/api/projects'),
        axios.get('/api/users/team')
      ]);

      // Filter out tasks that are currently in the optimistic "undo" state
      setTasks(tasksRes.data);
      setLogs(logsRes.data);
      setProjects(projectsRes.data);
      setTeamMembers(teamRes.data.team || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const counts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    setStats({
      'done': counts['done'] || 0,
      'in-progress': counts['in-progress'] || 0,
      'todo': counts['todo'] || 0,
      'in-review': counts['in-review'] || 0
    });
  }, [tasks]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Sync every 10s
    return () => clearInterval(interval);
  }, [completingIds]);

  const handleCompleteTask = (task) => {
    if (undoTask) {
      // If another task was being completed, finalize it immediately
      finalizeCompletion(undoTask._id);
    }

    setUndoTask(task);
    setCompletingIds(prev => new Set(prev).add(task._id));
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: 'done' } : t));

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      finalizeCompletion(task._id);
    }, 10000); // Set to 10s to match UI bar
  };

  const finalizeCompletion = async (taskId) => {
    try {
      await axios.put(`/api/tasks/${taskId}`, { status: 'done' });
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setUndoTask(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to complete task:', err);
      // Rollback on failure
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setUndoTask(null);
      fetchData();
    }
  };

  const handleUndo = () => {
    if (!undoTask) return;
    clearTimeout(undoTimer.current);
    const restoredTask = undoTask;
    setCompletingIds(prev => {
      const next = new Set(prev);
      next.delete(restoredTask._id);
      return next;
    });
    setTasks(prev => prev.map(t => t._id === restoredTask._id ? restoredTask : t));
    setUndoTask(null);
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const activeLoadPercent = stats.todo + stats['in-progress'] + stats['in-review'] + stats.done === 0
    ? 0
    : Math.round((stats['in-progress'] / (stats.todo + stats['in-progress'] + stats['in-review'] + stats.done)) * 100);

  if (loading) return <div className="flex items-center justify-center h-96 animate-pulse text-[var(--color-text-muted)]">Loading Dashboard...</div>;

  return (
    <div className="space-y-8 relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs md:text-sm text-[var(--color-text-secondary)]">Check your projects and tasks.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20 text-xs sm:text-sm"
          >
            <Plus size={18} /> Add New Task
          </button>
        </div>
      </header>

      <TaskCreateModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projects={projects}
        members={teamMembers}
        onTaskCreated={(newTask) => setTasks(prev => [newTask, ...prev])}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={stats.done}
          color="bg-[var(--color-status-done)]"
          delay={0.1}
          isActive={filter === 'done'}
          onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}
        />
        <StatCard
          icon={Clock}
          label="Working"
          value={stats['in-progress']}
          color="bg-[var(--color-status-progress)]"
          delay={0.2}
          isActive={filter === 'in-progress'}
          onClick={() => setFilter(filter === 'in-progress' ? 'all' : 'in-progress')}
        />
        <StatCard
          icon={AlertCircle}
          label="Review"
          value={stats['in-review']}
          color="bg-[var(--color-status-review)]"
          delay={0.3}
          isActive={filter === 'in-review'}
          onClick={() => setFilter(filter === 'in-review' ? 'all' : 'in-review')}
        />
        <StatCard
          icon={TrendingUp}
          label="Backlog"
          value={stats.todo}
          color="bg-[var(--color-status-todo)]"
          delay={0.4}
          isActive={filter === 'todo'}
          onClick={() => setFilter(filter === 'todo' ? 'all' : 'todo')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Panel - Filtered Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
              <h3 className="font-bold flex items-center gap-2">
                <Database size={18} className="text-[var(--color-action-primary)]" />
                Tasks: {filter.toUpperCase()}
              </h3>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{filteredTasks.length} Tasks</span>
            </div>
            <div className="divide-y divide-[var(--color-bg-border)] max-h-[500px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="p-20 text-center text-[var(--color-text-muted)] italic">No tasks match current filter.</div>
              ) : filteredTasks.map(task => {
                const isDone = task.status === 'done';
                const isFinalizing = completingIds.has(task._id);

                return (
                  <div key={task._id} className={`p-4 flex items-center justify-between hover:bg-[var(--color-bg-workspace)] transition-all group ${isDone ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => !isDone && handleCompleteTask(task)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isDone
                          ? 'bg-[var(--color-status-done)] border-[var(--color-status-done)] text-white cursor-default'
                          : 'border-[var(--color-bg-border)] text-transparent hover:border-[var(--color-status-done)] hover:bg-[var(--color-status-done)]/10 hover:text-[var(--color-status-done)]'
                          }`}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <div>
                        <p className={`text-sm font-bold text-[var(--color-text-primary)] ${isDone ? 'line-through decoration-2 decoration-green-500/50' : ''}`}>{task.title}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-tighter">Project: {projects.find(p => p._id === task.projectId)?.name || 'NONE'}</p>
                          {isFinalizing && (
                            <span className="text-[9px] text-[var(--color-action-primary)] font-black animate-pulse">● SAVING...</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isDone ? (
                        <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-lg">DONE</span>
                      ) : (
                        <Badge variant={task.priority === 'critical' || task.priority === 'high' ? 'critical' : 'todo'}>{task.priority}</Badge>
                      )}
                      <button
                        onClick={() => navigate(`/projects/${task.projectId}`)}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)]"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar Panel - Projects Progress */}
        <div className="space-y-6">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm p-6">
            <h3 className="font-bold mb-6 flex items-center gap-2">
              <Briefcase size={18} className="text-orange-500" /> Project Progress
            </h3>
            <div className="space-y-6">
              {projects.slice(0, 4).map(project => (
                <div key={project._id} className="space-y-2 cursor-pointer group" onClick={() => navigate(`/projects/${project._id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors">{project.name}</span>
                    <span className="text-[10px] font-bold text-[var(--color-action-primary)]">{project.progress}%</span>
                  </div>
                  <ProgressBar progress={project.progress} />
                  <div className="flex items-center gap-1 overflow-hidden">
                    {project.tags?.map(tag => (
                      <span key={tag} className="text-[8px] bg-[var(--color-bg-workspace)] px-1.5 py-0.5 rounded text-[var(--color-text-muted)] font-bold">#{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/projects')}
                className="w-full py-3 rounded-xl border border-dashed border-[var(--color-bg-border)] text-xs font-bold text-[var(--color-text-muted)] hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)] transition-all"
              >
                View All Projects
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Undo Notification */}
      <AnimatePresence>
        {undoTask && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-8 md:right-8 z-[200] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl shadow-2xl p-4 flex items-center gap-4 min-w-[280px] md:min-w-[300px]"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
              <CheckCircle2 size={20} className="md:size-24" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--color-text-primary)]">Task Done</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">"{undoTask.title}" has been completed.</p>
            </div>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-workspace)] hover:bg-[var(--color-bg-border)] rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw size={14} /> UNDO
            </button>
            <button onClick={() => setUndoTask(null)} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              <X size={16} />
            </button>
            <div className="absolute bottom-0 left-0 h-1 bg-[var(--color-action-primary)] rounded-full overflow-hidden w-full">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: 0 }}
                transition={{ duration: 10, ease: "linear" }}
                className="h-full bg-blue-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
