import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Trash2, Clock, AlertCircle, Check } from 'lucide-react';
import { NexusModal } from './ui';
import CKDropdown from './ui/CKDropdown';

const TaskDetailModal = ({ isOpen, onClose, task, onTaskUpdated, onTaskDeleted }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [desc, setDesc] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  React.useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDesc(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'medium');
    }
  }, [task]);

  const statusOptions = [
    { value: 'todo', label: 'To Do' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'in-review', label: 'In Review' },
    { value: 'done', label: 'Done' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(`/api/tasks/${task._id}`, {
        title,
        description: desc,
        status,
        priority
      });
      onTaskUpdated(res.data);
      onClose();
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/tasks/${task._id}`);
      onTaskDeleted(task._id);
      onClose();
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  const isDone = status === 'done';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <NexusModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task? This cannot be undone."
        type="danger"
        isConfirm
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
      <div className="bg-[var(--color-bg-surface)] w-full max-w-xl rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <header className="px-8 py-6 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
          <div>
            <h3 className="font-black text-[var(--color-text-primary)] text-xs uppercase tracking-[0.2em]">
              Edit Task
            </h3>
            <p className="text-[10px] text-[var(--color-text-muted)] font-bold mt-1">ID: {task._id.substring(0, 8).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-border)] rounded-xl transition-all">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Task Name</label>
            <input 
              type="text" 
              value={title}
              disabled={isDone}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-5 py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl focus:ring-2 focus:ring-[var(--color-action-primary)]/20 outline-none font-bold text-lg disabled:opacity-60"
              placeholder="What needs to be done?"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Notes & Details</label>
            <textarea 
              value={desc}
              disabled={isDone}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-5 py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl focus:ring-2 focus:ring-[var(--color-action-primary)]/20 outline-none min-h-[120px] text-sm leading-relaxed disabled:opacity-60"
              placeholder="Provide context or instructions..."
            />
          </div>

          <div className="grid grid-cols-2 gap-8">
            <CKDropdown 
              label="Status"
              options={statusOptions}
              value={status}
              disabled={isDone}
              onChange={setStatus}
              rightAction={isDone ? { icon: Check, onClick: () => {} } : null}
            />
            <CKDropdown 
              label="Priority Level"
              options={priorityOptions}
              value={priority}
              disabled={isDone}
              onChange={setPriority}
            />
          </div>

          {isDone && (
            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-2xl flex items-center gap-4">
               <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                  <CheckCircle2 size={24} />
               </div>
               <div>
                  <p className="text-sm font-bold text-green-600 uppercase tracking-tighter">Task Completed</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-bold">Completed on {task.completedAt ? new Date(task.completedAt).toLocaleString() : 'Recently'}</p>
               </div>
            </div>
          )}

          <div className="pt-8 border-t border-[var(--color-bg-border)] flex items-center justify-between">
            {!isDone ? (
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all"
              >
                <Trash2 size={14} /> Remove Task
              </button>
            ) : <div />}
            
            <div className="flex items-center gap-4">
              <button 
                type="button" 
                onClick={onClose}
                className="px-8 py-3 rounded-2xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] transition-all"
              >
                Close
              </button>
              {!isDone && (
                <button 
                  type="submit"
                  disabled={loading || !title}
                  className="bg-[var(--color-action-primary)] text-white px-10 py-3 rounded-2xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-3 shadow-xl shadow-blue-500/20"
                >
                  {loading ? 'Saving...' : <><CheckCircle2 size={20} /> Save Changes</>}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskDetailModal;
