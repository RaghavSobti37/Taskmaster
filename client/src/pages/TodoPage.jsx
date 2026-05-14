import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Clock,
  ListTodo,
  Calendar,
  Filter,
  ArrowUpRight,
  Users
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TaskCreateModal from '../components/TaskCreateModal';
import { Badge, PageHeader, PageContainer, Card, TabSwitcher } from '../components/ui';

const TodoPage = () => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [tasksRes, projectsRes, membersRes] = await Promise.all([
        axios.get('/api/tasks'),
        axios.get('/api/projects'),
        axios.get('/api/users/team')
      ]);
      setTasks(tasksRes.data);
      setProjects(projectsRes.data);
      setMembers(membersRes.data.team || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTask = async (task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      const res = await axios.put(`/api/tasks/${task._id}`, { status: newStatus });
      setTasks(tasks.map(t => t._id === task._id ? res.data : t));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await axios.delete(`/api/tasks/${id}`);
      setTasks(tasks.filter(t => t._id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'completed') return t.status === 'done';
    if (filter === 'pending') return t.status !== 'done';
    return true;
  });

  const TodoSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-20 bg-slate-100 rounded-[1.5rem]" />
      ))}
    </div>
  );

  if (loading && tasks.length === 0) return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-10 w-48 bg-slate-200 rounded mb-12" />
      <TodoSkeleton />
    </div>
  );

  return (
    <PageContainer>
      <PageHeader 
        icon={Users}
        title="To-Do List"
        subtitle="Your personal task tracker."
        actions={
          <TabSwitcher
            activeTab={filter}
            onChange={setFilter}
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' }
            ]}
          />
        }
      />

      <div 
        onClick={() => setIsTaskModalOpen(true)}
        className="relative cursor-pointer group mb-8"
      >
        <div className="w-full pl-6 pr-16 py-5 bg-[var(--color-bg-surface)] border-2 border-[var(--color-bg-border)] rounded-[2rem] text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] outline-none group-hover:border-blue-500 transition-all shadow-xl shadow-black/5 flex items-center">
          Add a new task...
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-blue-500 text-white rounded-2xl group-hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20">
          <Plus size={20} strokeWidth={3} />
        </div>
      </div>

      <TaskCreateModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projects={projects}
        members={members}
        onTaskCreated={(newTask) => setTasks([newTask, ...tasks])}
      />

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task, index) => {
            const isDone = task.status === 'done';
            const project = projects.find(p => p._id === task.projectId);
            
            return (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <Card className={`p-6 flex items-center justify-between group transition-all ${isDone ? 'opacity-60' : ''}`} hover>
                <div className="flex items-center gap-4 min-w-0">
                  <button 
                    onClick={() => toggleTask(task)}
                    className={`shrink-0 transition-colors ${isDone ? 'text-emerald-500' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
                  >
                    {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-xs font-black uppercase tracking-tight truncate ${isDone ? 'line-through' : 'text-[var(--color-text-primary)]'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-md text-[var(--color-text-muted)]">
                         {project?.name || 'NO PROJECT'}
                       </span>
                       <span className={`text-[8px] font-black uppercase tracking-widest ${task.priority === 'high' || task.priority === 'critical' ? 'text-rose-500' : task.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
                         {task.priority} priority
                       </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/projects/${task.projectId}`)}
                    className="p-2.5 text-[var(--color-text-muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ArrowUpRight size={18} />
                  </button>
                  <button 
                    onClick={() => deleteTask(task._id)}
                    className="p-2.5 text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="text-center py-20 opacity-20">
             <CheckCircle2 size={48} className="mx-auto mb-4" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">All done!</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default TodoPage;
