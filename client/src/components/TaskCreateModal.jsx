import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, UserPlus, Plus } from 'lucide-react';
import Select from 'react-select';
import CKDropdown from './ui/CKDropdown';

const TaskCreateModal = ({ isOpen, onClose, projectId, members, onTaskCreated }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(false);

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/api/tasks', {
        title,
        description: desc,
        priority,
        projectId,
        assignees: assignees.map(a => a.value),
        status: 'todo'
      });
      onTaskCreated(res.data);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-bg-surface)] w-full max-w-lg rounded-3xl border border-[var(--color-bg-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
          <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Plus size={18} className="text-[var(--color-action-primary)]" />
            Initialize Atomic Task
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Task Definition</label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              placeholder="e.g. Implement JWT Rotation"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Context / Briefing</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[100px] text-sm"
              placeholder="Add technical constraints or acceptance criteria..."
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
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Operatives</label>
              <Select 
                isMulti
                options={memberOptions}
                onChange={setAssignees}
                placeholder="Assign..."
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-bg-border)]">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] transition-all"
            >
              Abort
            </button>
            <button 
              type="submit"
              disabled={loading || !title}
              className="bg-[var(--color-action-primary)] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Initializing...' : <><CheckCircle2 size={18} /> Commit Task</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCreateModal;
