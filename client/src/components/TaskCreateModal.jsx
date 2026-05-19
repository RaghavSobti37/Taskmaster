import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, UserPlus, Plus } from 'lucide-react';
import Select from 'react-select';
import CKDropdown from './ui/CKDropdown';
import { addDays, format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects, useUserDirectory } from '../hooks/useTaskmasterQueries';

const TaskCreateModal = ({ isOpen, onClose, projectId: initialProjectId, members: passedMembers, projects: passedProjects, onTaskCreated }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: fetchedProjects = [] } = useProjects();
  const { data: fetchedMembers = [] } = useUserDirectory();
  
  const projects = passedProjects || fetchedProjects;
  const members = passedMembers || fetchedMembers;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [assignees, setAssignees] = useState(() => {
    return user ? [{ value: user._id, label: user.name }] : [];
  });
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDesc('');
      setPriority('medium');
      setProjectId(initialProjectId || '');
      setAssignees(user ? [{ value: user._id, label: user.name }] : []);
      setDueDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/tasks', {
        title,
        description: desc,
        priority,
        projectId: projectId || null,
        assignees: assignees.map(a => a.value),
        dueDate: dueDate || null,
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

  const memberOptions = members?.map(m => ({ 
    value: m.user?._id || m._id, 
    label: m.user?.name || m.name || 'Unknown' 
  })) || [];

  const projectOptions = projects?.map(p => ({
    value: p._id,
    label: p.name
  })) || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-bg-surface)] w-full max-w-lg rounded-3xl border border-[var(--color-bg-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
          <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Plus size={18} className="text-[var(--color-action-primary)]" />
            Create New Task
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!initialProjectId && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Select Project</label>
              <Select 
                options={projectOptions}
                value={projectOptions.find(p => p.value === projectId)}
                onChange={opt => setProjectId(opt.value)}
                placeholder="Select project..."
                className="react-select-container"
                classNamePrefix="react-select"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Task Title</label>
            <input 
              autoFocus={!!initialProjectId}
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              placeholder="e.g. Update homepage layout"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[100px] text-sm"
              placeholder="Add details or notes about this task..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <CKDropdown 
                label="Priority Level"
                options={priorityOptions}
                value={priority}
                onChange={setPriority}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Due Date (Optional)</label>
              <input 
                type="date"
                value={dueDate}
                onClick={e => e.target.showPicker && e.target.showPicker()}
                onFocus={e => e.target.showPicker && e.target.showPicker()}
                onKeyDown={e => e.preventDefault()}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none text-sm font-medium cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Assign To</label>
            <Select 
              isMulti
              options={memberOptions}
              value={assignees}
              onChange={setAssignees}
              placeholder="Assign to team members..."
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-bg-border)]">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || !title}
              className="bg-[var(--color-action-primary)] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Creating...' : <><CheckCircle2 size={18} /> Create Task</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCreateModal;
