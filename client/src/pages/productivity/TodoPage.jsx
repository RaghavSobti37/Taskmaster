import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Plus, Trash2, AlertCircle, Clock,
  ListTodo, Calendar, Filter, ArrowUpRight, Users,
  AlertTriangle, Info, Zap, Target, CheckSquare, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TaskCreateModal from '../../components/TaskCreateModal';
import {
  Badge, PageHeader, PageContainer, Card, TabSwitcher,
  Button, StatCard, NexusModal
} from '../../components/ui';

import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useProjects, useUserDirectory, useUpdateTask, useDeleteTask } from '../../hooks/useTaskmasterQueries';

const TodoPage = () => {
  const { user } = useAuth();
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useUserDirectory();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const [filter, setFilter] = useState('pending');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const navigate = useNavigate();

  const toggleTask = (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    updateTaskMutation.mutate({ id: task._id, data: { status: newStatus } });
  };

  const deleteTask = (id) => {
    deleteTaskMutation.mutate(id);
  };

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (filter === 'completed') return t.status === 'done';
    if (filter === 'pending') return t.status !== 'done';
    return true;
  }), [tasks, filter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const pending = total - done;
    const critical = tasks.filter(t => t.status !== 'done' && (t.priority === 'high' || t.priority === 'critical')).length;
    const velocity = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, critical, velocity };
  }, [tasks]);

  const overdueCount = useMemo(() => tasks.filter(t => {
    if (t.status === 'done' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  }).length, [tasks]);

  const dueTodayCount = useMemo(() => tasks.filter(t => {
    if (t.status === 'done' || !t.dueDate) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return new Date(t.dueDate).setHours(0, 0, 0, 0) === now.getTime();
  }).length, [tasks]);

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Tasks & To-Dos"
        subtitle="Manage your personal tasks and project backlogs."
        actions={
          <div className="flex items-center gap-2">
            <div className="bg-[var(--color-bg-secondary)] p-1 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)]">
              <TabSwitcher
                activeTab={filter}
                onChange={setFilter}
                tabs={[
                  { id: 'pending', label: 'BACKLOG' },
                  { id: 'completed', label: 'FINALIZED' },
                  { id: 'all', label: 'FULL INDEX' }
                ]}
                variant="compact"
              />
            </div>
            <Button size="sm" onClick={() => setIsTaskModalOpen(true)}><Plus size={14} /> Add Task</Button>
          </div>
        }
      />

      {/* Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Completion Rate" value={`${stats.velocity}%`} icon={Zap} variant="info" />
        <StatCard label="Active Backlog" value={stats.pending} icon={ListTodo} variant="mint" />
        <StatCard label="High Priority" value={stats.critical} icon={AlertTriangle} variant="rose" />
        <StatCard label="Status" value="ACTIVE" icon={RefreshCw} variant="slate" />
      </div>

      <AnimatePresence>
        {(overdueCount > 0 || dueTodayCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dueTodayCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-[var(--color-pastel-apricot-bg)] border border-[var(--color-pastel-apricot-text)]/20 rounded-[var(--radius-atomic)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-500 text-white rounded-lg shadow-sm"><Calendar size={14} /></div>
                  <span className="text-[10px] font-black uppercase text-[var(--color-pastel-apricot-text)]">Due Today</span>
                </div>
                <Badge variant="apricot">{dueTodayCount} DUE</Badge>
              </motion.div>
            )}
            {overdueCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-[var(--color-pastel-rose-bg)] border border-[var(--color-pastel-rose-text)]/20 rounded-[var(--radius-atomic)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-rose-500 text-white rounded-lg shadow-sm"><AlertTriangle size={14} /></div>
                  <span className="text-[10px] font-black uppercase text-[var(--color-pastel-rose-text)]">Overdue Tasks</span>
                </div>
                <Badge variant="rose">{overdueCount} OVERDUE</Badge>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12">
          <Card className="overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <CheckSquare size={14} className="text-blue-500" /> Task List
              </h3>
              <Badge variant="info">{filteredTasks.length} TASKS</Badge>
            </div>
            <div className="divide-y divide-[var(--color-bg-border)]">
              {filteredTasks.length === 0 ? (
                <div className="py-20 text-center opacity-20">
                  <ListTodo size={48} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No tasks found</p>
                </div>
              ) : filteredTasks.map((task, idx) => (
                <motion.div
                  key={task._id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group flex items-center justify-between p-4 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      className={`!p-1 rounded-full ${task.status === 'done' ? 'text-emerald-500 bg-emerald-500/10' : 'text-[var(--color-text-muted)]'}`}
                      onClick={() => toggleTask(task)}
                    >
                      {task.status === 'done' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </Button>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${task.status === 'done' ? 'line-through opacity-40' : 'text-[var(--color-text-primary)]'}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)]">{projects.find(p => p._id === task.projectId)?.name || 'GLOBAL'}</span>
                        <span className={`text-[8px] font-black uppercase ${task.priority === 'high' || task.priority === 'critical' ? 'text-rose-500' : task.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
                          {task.priority} PRIORITY
                        </span>
                        {task.dueDate && (
                          <span className="text-[8px] font-bold text-[var(--color-text-muted)] italic">
                            DUE: {format(new Date(task.dueDate), 'MMM dd')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="xs" onClick={() => navigate(`/projects/${task.projectId}`)}><ArrowUpRight size={14} /></Button>
                    <Button variant="ghost" size="xs" className="text-rose-500 hover:bg-rose-500/10" onClick={() => deleteTask(task._id)}><Trash2 size={14} /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <TaskCreateModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projects={projects}
        members={members}
      />
    </PageContainer>
  );
};

export default TodoPage;
