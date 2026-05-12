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
  X
} from 'lucide-react';
import axios from 'axios';
import { Badge, ProgressBar } from '../components/ui';
import { format, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ icon: Icon, label, value, color, delay, isActive, onClick }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    onClick={onClick}
    className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
      isActive 
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
  const undoTimer = useRef(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [tasksRes, logsRes, projectsRes] = await Promise.all([
        axios.get('/api/tasks'),
        axios.get('/api/logs'),
        axios.get('/api/projects')
      ]);
      
      const allTasks = tasksRes.data;
      setTasks(allTasks);
      setLogs(logsRes.data);
      setProjects(projectsRes.data);

      const counts = allTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});
      
      setStats({
        done: counts['done'] || 0,
        progress: counts['in-progress'] || 0,
        todo: counts['todo'] || 0,
        review: counts['in-review'] || 0
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Sync every 10s
    return () => clearInterval(interval);
  }, []);

  const handleCompleteTask = (task) => {
    if (undoTask) clearTimeout(undoTimer.current);
    
    setUndoTask(task);
    setTasks(prev => prev.filter(t => t._id !== task._id));
    
    undoTimer.current = setTimeout(async () => {
      try {
        await axios.put(`/api/tasks/${task._id}`, { status: 'done' });
        setUndoTask(null);
        fetchData();
      } catch (err) {
        console.error('Failed to complete task:', err);
      }
    }, 10000);
  };

  const handleUndo = () => {
    clearTimeout(undoTimer.current);
    setTasks(prev => [undoTask, ...prev]);
    setUndoTask(null);
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  
  const activeLoadPercent = stats.todo + stats.progress + stats.review + stats.done === 0 
    ? 0 
    : Math.round((stats.progress / (stats.todo + stats.progress + stats.review + stats.done)) * 100);

  if (loading) return <div className="flex items-center justify-center h-96 animate-pulse text-[var(--color-text-muted)]">Synchronizing Dashboard Matrix...</div>;

  return (
    <div className="space-y-8 relative">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control Center</h1>
          <p className="text-[var(--color-text-secondary)]">Overview of all active projects and tasks.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-bg-border)]">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-[var(--color-action-primary)] text-white shadow-lg shadow-blue-500/20' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            All Stream
          </button>
          <div className="w-px h-4 bg-[var(--color-bg-border)] mx-1" />
          <Badge variant={filter === 'all' ? 'todo' : filter}>{filter.toUpperCase()}</Badge>
        </div>
      </header>

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
          label="In Execution" 
          value={stats.progress} 
          color="bg-[var(--color-status-progress)]" 
          delay={0.2}
          isActive={filter === 'in-progress'}
          onClick={() => setFilter(filter === 'in-progress' ? 'all' : 'in-progress')}
        />
        <StatCard 
          icon={AlertCircle} 
          label="Inspection" 
          value={stats.review} 
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
                Task List: {filter.toUpperCase()}
              </h3>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{filteredTasks.length} Units</span>
            </div>
            <div className="divide-y divide-[var(--color-bg-border)] max-h-[500px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="p-20 text-center text-[var(--color-text-muted)] italic">No tasks match current filter.</div>
              ) : filteredTasks.map(task => (
                <div key={task._id} className="p-4 flex items-center justify-between hover:bg-[var(--color-bg-workspace)] transition-all group">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleCompleteTask(task)}
                      className="w-5 h-5 rounded-md border-2 border-[var(--color-bg-border)] flex items-center justify-center hover:border-[var(--color-status-done)] hover:bg-[var(--color-status-done)]/10 transition-all text-transparent hover:text-[var(--color-status-done)]"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{task.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-tighter">PRJ: {projects.find(p => p._id === task.projectId)?.name || 'ORPHAN'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={task.priority === 'critical' || task.priority === 'high' ? 'critical' : 'todo'}>{task.priority}</Badge>
                    <button 
                      onClick={() => navigate(`/projects/${task.projectId}`)}
                      className="p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)]"
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6">
            {/* Active Load Replaced Temporal Deadlines */}
            <div className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm p-8 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-bold flex items-center gap-2 text-[var(--color-action-primary)]">
                  <TrendingUp size={18} /> Active Load Capacity
                </h3>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-black tracking-widest">Global Resource Allocation</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-[var(--color-text-primary)]">{activeLoadPercent}%</p>
                <div className="w-32 h-1.5 bg-[var(--color-bg-border)] rounded-full mt-2 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${activeLoadPercent}%` }}
                    className="h-full bg-[var(--color-action-primary)]"
                  />
                </div>
              </div>
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

          <section className="bg-gradient-to-br from-[var(--color-action-primary)] to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20">
            <h3 className="font-bold mb-2">System Integrity</h3>
            <p className="text-xs opacity-80 mb-4">All operational nodes are currently synchronized with the main cluster.</p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Optimal Performance
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
            className="fixed bottom-8 right-8 z-[200] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl shadow-2xl p-4 flex items-center gap-4 min-w-[300px]"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--color-text-primary)]">Task Finalized</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">Unit "{undoTask.title}" has been completed.</p>
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
