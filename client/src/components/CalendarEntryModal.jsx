import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Calendar as CalIcon } from 'lucide-react';

const CalendarEntryModal = ({ isOpen, onClose, onEntryCreated }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      axios.get('/api/projects').then(res => {
        setProjects(res.data);
        if (res.data.length > 0) setProjectId(res.data[0]._id);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/api/tasks', {
        title,
        dueDate: date,
        projectId,
        status: 'todo',
        priority: 'medium',
        description: 'Scheduled via Temporal Layout'
      });
      onEntryCreated(res.data);
      onClose();
    } catch (err) {
      console.error('Error creating calendar entry:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-bg-surface)] w-full max-w-md rounded-3xl border border-[var(--color-bg-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
          <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <CalIcon size={18} className="text-[var(--color-action-primary)]" />
            Schedule Temporal Unit
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Event Identifier</label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              placeholder="e.g. System Audit"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Temporal Anchor</label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project Alignment</label>
            <select 
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold appearance-none"
              required
            >
              <option value="" disabled>Select Project Nexus</option>
              {projects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-bg-border)]">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)]"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || !title}
              className="bg-[var(--color-action-primary)] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Scheduling...' : <><CheckCircle2 size={18} /> Confirm Entry</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarEntryModal;
