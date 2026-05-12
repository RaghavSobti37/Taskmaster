import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp 
} from 'lucide-react';
import axios from 'axios';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] shadow-sm hover:shadow-md transition-shadow"
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
  const [stats, setStats] = useState({
    done: 0,
    progress: 0,
    todo: 0,
    review: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/api/tasks');
        const tasks = res.data;
        const counts = tasks.reduce((acc, task) => {
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
        console.error('Error fetching stats:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-[var(--color-text-secondary)]">Welcome back. Here's what's happening across your projects.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={CheckCircle2} 
          label="Completed Tasks" 
          value={stats.done} 
          color="bg-[var(--color-status-done)]" 
          delay={0.1}
        />
        <StatCard 
          icon={Clock} 
          label="In Progress" 
          value={stats.progress} 
          color="bg-[var(--color-status-progress)]" 
          delay={0.2}
        />
        <StatCard 
          icon={AlertCircle} 
          label="Pending Review" 
          value={stats.review} 
          color="bg-[var(--color-status-review)]" 
          delay={0.3}
        />
        <StatCard 
          icon={TrendingUp} 
          label="Backlog" 
          value={stats.todo} 
          color="bg-[var(--color-status-todo)]" 
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] h-80 flex flex-col items-center justify-center">
          <TrendingUp size={48} className="text-[var(--color-bg-border)] mb-4" />
          <p className="text-[var(--color-text-muted)] italic">Activity Heatmap Placeholder</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">Real-time interaction stream monitoring active</p>
        </div>
        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] h-80 flex flex-col items-center justify-center">
          <Clock size={48} className="text-[var(--color-bg-border)] mb-4" />
          <p className="text-[var(--color-text-muted)] italic">Resource Allocation Placeholder</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">Weighted effort calculations in progress</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
