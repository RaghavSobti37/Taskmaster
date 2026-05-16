import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  LayoutDashboard,
  Briefcase,
  RotateCcw,
  Plus,
  Calendar as CalendarIcon,
  FileText,
  Shield,
  Users
} from 'lucide-react';
import axios from 'axios';
import { 
  Badge, 
  ProgressBar, 
  PageHeader, 
  Card, 
  PageContainer, 
  DataTable, 
  VelocitySparkline,
  StatCard,
  Button,
  DashboardSkeleton,
  FullScreenWorkspace,
  Input
} from '../components/ui';

import { useQueryClient } from '@tanstack/react-query';
import TaskCreateModal from '../components/TaskCreateModal';
import { format, subDays, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks, useProjects, useUserDirectory, useDashboardSummary } from '../hooks/useTaskmasterQueries';

const Dashboard = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [undoTask, setUndoTask] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const undoTimer = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: teamMembers = [] } = useUserDirectory();

  const loading = summaryLoading || tasksLoading || projectsLoading;

  const handleCompleteTask = async (task) => {
    setCompletingIds(prev => new Set(prev).add(task._id));
    try {
      await axios.put(`/api/tasks/${task._id}`, { status: 'done' });
      setUndoTask(task);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoTask(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    } catch (err) {
      console.error('Task completion failed:', err);
    } finally {
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(task._id);
        return next;
      });
    }
  };

  const handleUndo = async () => {
    if (!undoTask) return;
    try {
      await axios.put(`/api/tasks/${undoTask._id}`, { status: 'todo' });
      setUndoTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    } catch (err) {
      console.error('Task undo failed:', err);
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

  const taskColumns = [
    {
      header: 'Task Detail',
      render: (row) => (
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); handleCompleteTask(row); }}
            disabled={completingIds.has(row._id)}
            className="w-5 h-5 rounded-full border-2 border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)] flex items-center justify-center transition-all group"
          >
            {completingIds.has(row._id) ? (
              <div className="w-2 h-2 rounded-full bg-[var(--color-action-primary)] animate-pulse" />
            ) : (
              <CheckCircle2 size={12} className="opacity-0 group-hover:opacity-100 text-[var(--color-action-primary)]" />
            )}
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-[11px] uppercase tracking-tight">{row.title}</span>
            <span className="text-[9px] text-[var(--color-text-muted)] font-bold">{projects.find(p => p._id === row.projectId)?.name || 'General'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Priority',
      render: (row) => (
        <Badge variant={row.priority === 'critical' ? 'danger' : row.priority === 'high' ? 'warning' : 'info'}>
          {row.priority}
        </Badge>
      )
    }
  ];

  if (loading && tasks.length === 0) return <DashboardSkeleton />;

  const { metrics = {}, calendar = [], velocity = 'Stable' } = summary || {};

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
        title="Operational Overview" 
        subtitle={`Welcome back, ${user?.name?.split(' ')[0]}. Here is your current mission status.`}
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={16} /> New Work Item
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Work Completed" value={`${metrics.completionRate}%`} icon={CheckCircle2} variant="mint" info="The percentage of assigned tasks you have finished." />
        <StatCard label="Urgent Tasks" value={metrics.criticalTasks} icon={AlertCircle} variant="rose" info="Important work items that need your attention immediately." />
        <StatCard label="Overdue Items" value={metrics.overdueTasks} icon={Clock} variant="apricot" info="Tasks that have passed their planned completion date." />
        <StatCard label="Focus Time Today" value={`${metrics.focusHours}h`} icon={TrendingUp} variant="info" info="Total time logged on tasks within the last 24 hours." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="flex flex-col">
            <div className="p-3 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
               <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <Briefcase size={14} className="text-[var(--color-action-primary)]" />
                 Active Workflow
               </h3>
               <div className="flex items-center gap-2">
                  <button onClick={() => setFilter('all')} className={`text-[10px] font-black uppercase px-2 py-1 rounded-md transition-all ${filter === 'all' ? 'bg-[var(--color-bg-primary)] shadow-sm text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'}`}>All Items</button>
               </div>
            </div>
            <div className="p-0">
               <DataTable 
                 columns={taskColumns} 
                 data={tasks.filter(t => t.status !== 'done')} 
                 onRowClick={(task) => setSelectedTask(task)}
               />
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-4 space-y-6">
           <Card className="p-4 bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] overflow-hidden relative">
              <div className="relative z-10 space-y-4">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Mission Velocity</h4>
                    <Badge variant={velocity === 'Optimal' ? 'success' : 'warning'}>{velocity}</Badge>
                 </div>
                 <VelocitySparkline data={sparklineData} />
              </div>
           </Card>

           <Card className="p-0 flex flex-col">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
                 <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <CalendarIcon size={14} className="text-blue-500" /> Today's Schedule
                 </h4>
                 <Badge variant="info">{calendar.length}</Badge>
              </div>
              <div className="p-4 space-y-3">
                 {calendar.length === 0 ? (
                   <p className="text-[10px] text-[var(--color-text-muted)] font-bold italic text-center py-4">No events planned for today</p>
                 ) : calendar.map(event => (
                   <div key={event._id} className="flex flex-col p-2.5 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] gap-1">
                      <div className="flex justify-between items-start">
                         <span className="text-[10px] font-black uppercase tracking-tight">{event.title}</span>
                         <span className="text-[8px] font-bold text-blue-500 bg-blue-500/5 px-1.5 rounded uppercase">{event.visibility}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-[var(--color-text-muted)] font-bold">
                         <Clock size={10} /> {event.time || 'All Day'}
                      </div>
                   </div>
                 ))}
              </div>
           </Card>

           <Card className="p-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                 <Users size={14} /> My Squad
              </h4>
              <div className="space-y-4">
                 {teamMembers.slice(0, 4).map(member => {
                    const memberTasks = tasks.filter(t => t.assignees?.includes(member._id));
                    const progress = memberTasks.length ? Math.round((memberTasks.filter(t => t.status === 'done').length / memberTasks.length) * 100) : 0;
                    return (
                      <div key={member._id} className="space-y-1.5">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] overflow-hidden">
                                  {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black">{member.name?.substring(0, 2)}</div>}
                               </div>
                               <span className="text-[10px] font-bold">{member.name}</span>
                            </div>
                            <span className="text-[9px] font-black text-[var(--color-text-muted)]">{progress}%</span>
                         </div>
                         <ProgressBar progress={progress} />
                      </div>
                    );
                 })}
              </div>
           </Card>
        </aside>
      </div>

      <AnimatePresence>
        {undoTask && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 border border-slate-800"
          >
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span className="text-[11px] font-bold uppercase tracking-tight">Work item finished</span>
            </div>
            <button onClick={handleUndo} className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
               <RotateCcw size={12} /> Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FullScreenWorkspace
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || 'Item Details'}
        subtitle={`Project: ${projects.find(p => p._id === selectedTask?.projectId)?.name || 'Unlinked'} • Status: ${selectedTask?.status?.toUpperCase()}`}
        onSave={() => setSelectedTask(null)}
        sidebar={
          <div className="space-y-4">
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Configuration</h4>
               <div className="space-y-3">
                  <div className="flex justify-between">
                     <span className="text-[10px] font-bold">Priority Level</span>
                     <Badge variant={selectedTask?.priority === 'critical' ? 'danger' : 'info'}>{selectedTask?.priority}</Badge>
                  </div>
               </div>
            </Card>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Team Members</h4>
               <div className="flex -space-x-2">
                  {selectedTask?.assignees?.map((a, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--color-bg-primary)] bg-[var(--color-bg-secondary)] flex items-center justify-center text-[10px] font-black overflow-hidden">
                       {/* This assumes assignees are objects with name/avatar. If IDs, would need mapping */}
                       {typeof a === 'object' ? (a.avatar ? <img src={a.avatar} className="w-full h-full object-cover" alt="" /> : a.name?.substring(0, 2)) : '..'}
                    </div>
                  ))}
               </div>
            </Card>
          </div>
        }
      >
        <div className="space-y-8">
           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <FileText size={14} /> Description
              </h3>
              <div className="p-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-bg-border)]">
                 <p className="text-sm font-medium leading-relaxed">
                   {selectedTask?.description || 'No detailed instructions provided for this work item.'}
                 </p>
              </div>
           </section>

           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Shield size={14} /> Data Update
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input label="Task Title" defaultValue={selectedTask?.title} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Associated Project</label>
                    <select 
                      className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
                      defaultValue={selectedTask?.projectId}
                    >
                       {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Deadline</label>
                    <input 
                      type="date" 
                      defaultValue={selectedTask?.dueDate ? format(new Date(selectedTask.dueDate), 'yyyy-MM-dd') : ''}
                      className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Priority Status</label>
                    <select 
                      className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
                      defaultValue={selectedTask?.priority}
                    >
                       <option value="low">low</option>
                       <option value="medium">medium</option>
                       <option value="high">high</option>
                       <option value="critical">critical</option>
                    </select>
                 </div>
              </div>
           </section>
        </div>
      </FullScreenWorkspace>

      <TaskCreateModal 
        isOpen={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
        onTaskCreated={() => {
          setIsTaskModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
        }}
      />
    </PageContainer>
  );
};

export default Dashboard;
