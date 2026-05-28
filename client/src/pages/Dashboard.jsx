import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Plus, FileText, Shield, Zap, Target, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { 
  Badge, 
  PageHeader, 
  Card, 
  PageContainer, 
  Button,
  DashboardSkeleton,
  FullScreenWorkspace,
  Input
} from '../components/ui';

import { useQueryClient, useQuery } from '@tanstack/react-query';
import TaskCreateModal from '../components/TaskCreateModal';
import TaskDetailModal from '../components/TaskDetailModal';
import { format, subDays, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTasks, useProjects, useWorkspaces, useDashboardSummary } from '../hooks/useTaskmasterQueries';
import { 
  StatCards, 
  ScheduleCard, 
  LeaderboardCard,
  AnnouncementsCard,
  TaskTable 
} from '../components/dashboard';

const MissionCompleteModal = ({ mission, isOpen, onClose }) => {
  if (!isOpen || !mission) return null;

  return (
    <AnimatePresence>
      <div className="tm-modal-overlay fixed inset-0 z-[9999] p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="tm-modal-panel max-w-sm bg-slate-900 border border-amber-500/30 rounded-[2rem] p-8 relative overflow-hidden text-center shadow-2xl shadow-amber-500/20"
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="text-6xl mb-4 inline-block"
          >
            🏆
          </motion.div>
          
          <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Mission Complete!</h2>
          <p className="text-sm font-bold text-slate-300 mb-6">{mission.title}</p>
          
          <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700 relative overflow-hidden">
             <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Experience Gained</span>
                <span className="text-lg font-black text-amber-400">+{mission.expReward} XP</span>
             </div>
             
             {/* Simulated EXP Bar Increasing */}
             <div className="h-3 bg-slate-900 rounded-full overflow-hidden w-full relative">
                <motion.div 
                  initial={{ width: '40%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500 to-yellow-300"
                />
             </div>
          </div>
          
          <Button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-600 !text-white font-black uppercase tracking-widest border-none">
            Awesome!
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

import TaskCompletionModal from '../components/TaskCompletionModal';

const Dashboard = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [completingIds, setCompletingIds] = useState(new Set());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: workspaces = [] } = useWorkspaces();

  const { data: missions = [] } = useQuery({
    queryKey: ['missions'],
    queryFn: async () => (await axios.get('/api/gamification/missions')).data,
    refetchInterval: 15000
  });

  const prevMissionsRef = useRef([]);
  const [completedMission, setCompletedMission] = useState(null);

  useEffect(() => {
    if (missions.length > 0) {
      if (prevMissionsRef.current.length > 0) {
        missions.forEach(m => {
          const prev = prevMissionsRef.current.find(p => p._id === m._id);
          if (prev && !prev.completed && m.completed) {
            setCompletedMission(m);
          }
        });
      }
      prevMissionsRef.current = missions;
    }
  }, [missions]);



  const triggerCompleteTask = (task) => {
    setTaskToComplete(task);
  };

  const handleCompleteTaskSubmit = async (task, hours) => {
    setCompletingIds(prev => new Set(prev).add(task._id));
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

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setTaskToComplete(null);
    } catch (err) {
      console.error('Task completion failed:', err);
      addToast({
        title: 'Completion Failed',
        message: err.response?.data?.error || 'Could not finish task.',
        type: 'error'
      });
    } finally {
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(task._id);
        return next;
      });
    }
  };

  const sparklineData = useMemo(() => {
     return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'MMM d'),
        count: tasks.filter(t => t.status === 'done' && t.updatedAt && isSameDay(new Date(t.updatedAt), date)).length
      };
    });
  }, [tasks]);

  const { metrics = {}, calendar = [], velocity = 'Stable' } = summary || {};

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
        title="Dashboard" 
        subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'Member'}. Here is your current work status.`}
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={16} /> New Work Item
            </Button>
          </div>
        }
      />

      <StatCards metrics={metrics} loading={summaryLoading} onCardClick={(f) => setFilter(f)} activeFilter={filter} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <TaskTable 
            tasks={tasks}
            projects={projects}
            workspaces={workspaces}
            completingIds={completingIds}
            onCompleteTask={triggerCompleteTask}
            onSelectTask={(task) => {
              if (task.projectId) {
                navigate(`/projects/${task.projectId}`);
              } else {
                setSelectedTask(task);
              }
            }}
            filter={filter}
            setFilter={setFilter}
            loading={tasksLoading}
          />
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <AnnouncementsCard />

          
          
          <ScheduleCard calendar={calendar} loading={summaryLoading} />
          <LeaderboardCard />
          <Card className="p-4 space-y-4 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
               <Target size={14} /> Mission Hub
            </h4>
            <div className="space-y-2">
               {missions.map(mission => (
                 <div key={mission._id} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${mission.completed ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[var(--color-bg-primary)] border-[var(--color-bg-border)]'}`}>
                   <div className="flex items-center gap-3">
                     <div className={`p-1.5 rounded-full ${mission.completed ? 'bg-amber-500 text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'}`}>
                       <CheckCircle size={14} />
                     </div>
                     <div>
                       <p className={`text-xs font-bold ${mission.completed ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text-primary)]'}`}>{mission.title}</p>
                       <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">{mission.currentCount} / {mission.targetCount} • {mission.expReward} XP</p>
                     </div>
                   </div>
                 </div>
               ))}
               {missions.length === 0 && (
                 <p className="text-xs font-medium text-[var(--color-text-muted)] text-center py-4">Generating missions...</p>
               )}
            </div>
          </Card>
          
        </aside>
      </div>

      <TaskDetailModal 
        isOpen={!!selectedTask} 
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={(updatedTask) => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });

          setSelectedTask(null);
        }}
        onTaskDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
          setSelectedTask(null);
        }}
      />

      <TaskCreateModal 
        isOpen={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
        }}
      />


      <MissionCompleteModal 
        mission={completedMission}
        isOpen={!!completedMission}
        onClose={() => setCompletedMission(null)}
      />

      <TaskCompletionModal 
        task={taskToComplete}
        isOpen={!!taskToComplete}
        onClose={() => setTaskToComplete(null)}
        onSubmit={handleCompleteTaskSubmit}
      />
    </PageContainer>
  );
};

export default Dashboard;
