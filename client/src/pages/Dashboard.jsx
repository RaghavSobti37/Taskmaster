import React, { useState, useMemo } from 'react';
import { LayoutDashboard, Plus, FileText, Shield, Zap } from 'lucide-react';
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

import { useQueryClient } from '@tanstack/react-query';
import TaskCreateModal from '../components/TaskCreateModal';
import { format, subDays, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTasks, useProjects, useUserDirectory, useDashboardSummary } from '../hooks/useTaskmasterQueries';
import { 
  StatCards, 
  ScheduleCard, 
  SquadCard, 
  TaskTable 
} from '../components/dashboard';

const Dashboard = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [completingIds, setCompletingIds] = useState(new Set());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, done
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const handleSyncBookedCalls = async () => {
    setSyncStatus('syncing');
    try {
      await axios.post('/api/crm/sync-bookings?sheet=BookedCalls');
      setSyncStatus('done');
      setTimeout(() => setSyncStatus('idle'), 2000);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'followups'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    } catch (err) {
      setSyncStatus('done');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(user?._id);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: teamMembers = [] } = useUserDirectory();

  const loading = summaryLoading || tasksLoading || projectsLoading;

  const handleCompleteTask = async (task) => {
    setCompletingIds(prev => new Set(prev).add(task._id));
    try {
      await axios.put(`/api/tasks/${task._id}`, { status: 'done' });
      
      addToast({
        title: 'Task Finished',
        message: `Successfully completed "${task.title}".`,
        type: 'success',
        duration: 6000,
        undoAction: async () => {
          await axios.put(`/api/tasks/${task._id}`, { status: 'todo' });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
        }
      });

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
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

  if (loading && tasks.length === 0) return <DashboardSkeleton />;

  const { metrics = {}, calendar = [], velocity = 'Stable' } = summary || {};

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
        title="Dashboard" 
        subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'Member'}. Here is your current work status.`}
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="mint" size="sm" onClick={handleSyncBookedCalls} disabled={syncStatus === 'syncing'}>
              <Zap size={16} /> {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'done' ? 'Done' : 'Sync Booked Calls'}
            </Button>
            <Button size="sm" onClick={() => setIsTaskModalOpen(true)}>
              <Plus size={16} /> New Work Item
            </Button>
          </div>
        }
      />

      <StatCards metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <TaskTable 
            tasks={tasks}
            projects={projects}
            completingIds={completingIds}
            onCompleteTask={handleCompleteTask}
            onSelectTask={setSelectedTask}
            filter={filter}
            setFilter={setFilter}
          />
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <ScheduleCard calendar={calendar} />
          <SquadCard teamMembers={teamMembers} tasks={tasks} />
        </aside>
      </div>

      <FullScreenWorkspace
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || 'Item Details'}
        subtitle={`Project: ${projects.find(p => p._id === selectedTask?.projectId)?.name || 'Unlinked'} • Status: ${selectedTask?.status?.toUpperCase()}`}
        onSave={() => setSelectedTask(null)}
        sidebar={
          <div className="space-y-4">
            <Card className="p-5 space-y-4 bg-[var(--color-bg-primary)] shadow-sm">
               <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Task Settings</h4>
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-[var(--color-text-primary)]">Priority Level</span>
                     <Badge variant={selectedTask?.priority === 'critical' ? 'danger' : 'info'}>
                       {selectedTask?.priority}
                     </Badge>
                  </div>
               </div>
            </Card>
            <Card className="p-5 space-y-4 bg-[var(--color-bg-primary)] shadow-sm">
               <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Team Members</h4>
               <div className="flex -space-x-2">
                  {selectedTask?.assignees?.map((a, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--color-bg-primary)] bg-[var(--color-bg-secondary)] flex items-center justify-center text-xs font-bold overflow-hidden">
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <FileText size={16} /> Description
              </h3>
              <div className="p-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-bg-border)] shadow-sm">
                 <p className="text-sm font-medium leading-relaxed text-[var(--color-text-primary)]">
                   {selectedTask?.description || 'No detailed instructions provided for this work item.'}
                 </p>
              </div>
           </section>

           <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Shield size={16} /> Edit Task
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input label="Task Title" defaultValue={selectedTask?.title} />
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Associated Project</label>
                    <select 
                      className="w-full px-3.5 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none font-medium"
                      defaultValue={selectedTask?.projectId}
                    >
                       {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Deadline</label>
                    <input 
                      type="date" 
                      defaultValue={selectedTask?.dueDate ? format(new Date(selectedTask.dueDate), 'yyyy-MM-dd') : ''}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                      onFocus={e => e.target.showPicker && e.target.showPicker()}
                      onKeyDown={e => e.preventDefault()}
                      className="w-full px-3.5 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none font-medium cursor-pointer"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Priority Status</label>
                    <select 
                      className="w-full px-3.5 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none font-medium"
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
