import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Plus } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { addDays, format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory } from '../constants/taskOptions';
import TaskFormFields from './forms/TaskFormFields';

const TaskCreateModal = ({ isOpen, onClose, projectId: initialProjectId, members: passedMembers, projects: passedProjects, onTaskCreated }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: fetchedProjects = [] } = useProjects();
  const projects = passedProjects || fetchedProjects;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [formValues, setFormValues] = useState({
    priority: 'medium',
    projectId: initialProjectId || '',
    workspace: 'General',
    assignees: user ? [user._id] : [],
    dueDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    scheduleDate: format(new Date(), 'yyyy-MM-dd'),
    scheduleSlot: 'AM',
    type: '',
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const project = projects.find((p) => p._id === (initialProjectId || ''));
      setTitle('');
      setDesc('');
      setFormValues({
        priority: 'medium',
        projectId: initialProjectId || '',
        workspace: project?.workspace || 'General',
        assignees: user ? [user._id] : [],
        dueDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        scheduleDate: format(new Date(), 'yyyy-MM-dd'),
        scheduleSlot: 'AM',
        type: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/tasks', {
        title,
        description: desc,
        priority: formValues.priority,
        type: normalizeTaskCategory(formValues.type),
        workspace: formValues.workspace,
        scheduleDate: formValues.scheduleDate || null,
        scheduleSlot: formValues.scheduleSlot,
        projectId: formValues.projectId || null,
        assignees: formValues.assignees,
        dueDate: formValues.dueDate || null,
        status: 'todo'
      });
      if (onTaskCreated) onTaskCreated(res.data);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      onClose();
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100}>
      <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)] shrink-0">
        <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Plus size={18} className="text-[var(--color-action-primary)]" />
          Create New Task
        </h3>
        <button type="button" onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
          <X size={20} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Task Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold text-sm"
            placeholder="What needs to be done?"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[80px] text-sm"
            placeholder="Add details..."
          />
        </div>

        <TaskFormFields
          values={formValues}
          onChange={setFormValues}
          projects={projects}
          members={passedMembers}
          showProject={!initialProjectId}
          lockProject={!!initialProjectId}
          showStatus={false}
        />

        <div className="pt-4 border-t border-[var(--color-bg-border)] flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-bold text-[var(--color-text-muted)]">Cancel</button>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="bg-[var(--color-action-primary)] text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 size={18} /> {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export default TaskCreateModal;
