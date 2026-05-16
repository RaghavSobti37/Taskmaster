import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Calendar as CalIcon, Globe, Lock } from 'lucide-react';

const CalendarEntryModal = ({ isOpen, onClose, onEntryCreated, initialData = null }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDate(initialData.dueDate ? initialData.dueDate.split('T')[0] : '');
      setDescription(initialData.description || '');
      setVisibility(initialData.visibility || 'private');
    } else {
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setVisibility('private');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      alert("Cannot create calendar events for past dates.");
      return;
    }

    setLoading(true);
    try {
      if (initialData?._id) {
        const res = await axios.put(`/api/calendar/${initialData._id}`, {
          title,
          date,
          description,
          visibility
        });
        onEntryCreated(res.data, true); // true indicates update
      } else {
        const res = await axios.post('/api/calendar', {
          title,
          date,
          description,
          visibility
        });
        onEntryCreated(res.data, false); // false indicates new entry
      }
      onClose();
    } catch (err) {
      console.error('Error saving calendar entry:', err);
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
            {initialData ? 'Edit Event' : 'New Calendar Event'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Event Name</label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              placeholder="e.g. Team meeting"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Date</label>
            <input 
              type="date" 
              min={new Date().toISOString().split('T')[0]}
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description (optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold min-h-[80px] resize-none"
              placeholder="Add details..."
            />
          </div>

          {/* Visibility Toggle */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Who can see this?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs border transition-all ${
                  visibility === 'private'
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 shadow-sm'
                    : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-purple-500/30'
                }`}
              >
                <Lock size={14} />
                Only Me
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs border transition-all ${
                  visibility === 'public'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shadow-sm'
                    : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-emerald-500/30'
                }`}
              >
                <Globe size={14} />
                Everyone
              </button>
            </div>
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
              {loading ? 'Saving...' : <><CheckCircle2 size={18} /> {initialData ? 'Update Event' : 'Save Event'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarEntryModal;
