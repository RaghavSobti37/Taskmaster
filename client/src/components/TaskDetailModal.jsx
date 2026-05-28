import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Trash2, Clock, AlertCircle, Check } from 'lucide-react';
import { NexusModal, ModalShell } from './ui';
import { globalToast } from '../contexts/ToastContext';
import CKDropdown from './ui/CKDropdown';
import { useUserDirectory } from '../hooks/useTaskmasterQueries';

const TaskDetailModal = ({ isOpen, onClose, task, onTaskUpdated, onTaskDeleted }) => {
  const { data: members = [] } = useUserDirectory();
  const [title, setTitle] = useState(task?.title || '');
  const [desc, setDesc] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [assignees, setAssignees] = useState(task?.assignees?.map(a => typeof a === 'object' ? a._id : a) || []);
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // You can pass members as a prop or fetch them here. For now, assuming memberOptions might be needed or passed.
  // We will assume `members` is passed as a prop from parent, or fetch them if needed.

  React.useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDesc(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'medium');
      setAssignees(task.assignees?.map(a => typeof a === 'object' ? a._id : a) || []);
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      
      // Fetch logs for this task
      axios.get(`/api/logs?targetId=${task._id}`)
        .then(res => setLogs(res.data))
        .catch(err => console.error('Error fetching task logs:', err));
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

  const memberOptions = members?.map(m => ({ 
    value: m.user?._id || m._id, 
    label: m.user?.name || m.name || 'Unknown' 
  })) || [];

  if (!task) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(`/api/tasks/${task._id}`, {
        title,
        description: desc,
        status,
        priority,
        assignees,
        dueDate: dueDate || null
      });
      if (status === 'done' && task.status !== 'done') {
        globalToast.addToast({
          title: 'Task Finished',
          message: `Successfully completed "${title}".`,
          type: 'success',
          duration: 6000
        });
      }
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
    <>
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
      <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100}>
        <header className="px-5 py-3 md:px-8 md:py-3 border-b border-[var(--color-bg-border)] flex items-center justify-between gap-4 bg-[var(--color-bg-workspace)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {task.createdBy && (
              <div className="w-5 h-5 rounded-full overflow-hidden bg-[var(--color-bg-border)] border border-[var(--color-bg-border)] flex-shrink-0">
                {task.createdBy.avatar ? (
                  <img src={task.createdBy.avatar} alt={task.createdBy.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-[var(--color-text-muted)] text-[9px] font-bold">
                    {task.createdBy.name?.slice(0, 1).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-black text-[var(--color-text-primary)] text-xs uppercase tracking-[0.2em]">Edit Task</h3>
              <p className="text-[9px] text-[var(--color-text-muted)] font-bold">
                {task.createdBy && <span>By {task.createdBy.name}</span>} 
                {task.createdBy && <span className="text-[8px] mx-1">•</span>}
                <span>ID: {task._id.substring(0, 8).toUpperCase()}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-all flex-shrink-0">
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1">
          <div className="space-y-3">
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Task Name</label>
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
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Notes & Details</label>
            <textarea 
              value={desc}
              disabled={isDone}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-5 py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl focus:ring-2 focus:ring-[var(--color-action-primary)]/20 outline-none min-h-[120px] text-sm leading-relaxed disabled:opacity-60"
              placeholder="Provide context or instructions..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            <CKDropdown 
              multi
              label="Assign To"
              options={memberOptions}
              value={assignees}
              disabled={isDone}
              onChange={setAssignees}
              placeholder="Assign to team members..."
            />
            <div className="space-y-3">
              <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Due Date</label>
              <input 
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={isDone}
                className="w-full px-5 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl focus:ring-2 focus:ring-[var(--color-action-primary)]/20 outline-none text-sm font-bold disabled:opacity-60"
              />
            </div>
          </div>

          {/* Activity Logs Section */}
          

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
          <div className="pt-6 md:pt-8 border-t border-[var(--color-bg-border)] flex flex-col-reverse sm:flex-row items-center justify-between gap-4 sticky bottom-0 bg-[var(--color-bg-workspace)]">
            {!isDone ? (
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto flex justify-center items-center gap-2 text-red-500 font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/10 px-4 py-3 sm:py-2 rounded-xl transition-all"
              >
                <Trash2 size={14} /> Remove Task
              </button>
            ) : <div className="hidden sm:block" />}
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <button 
                type="button" 
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] transition-all"
              >
                Close
              </button>
              {!isDone && (
                <button 
                  type="submit"
                  disabled={loading || !title}
                  className="w-full sm:w-auto justify-center bg-[var(--color-action-primary)] text-white px-8 md:px-10 py-3 rounded-2xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-3 shadow-xl shadow-blue-500/20"
                >
                  {loading ? 'Saving...' : <><CheckCircle2 size={20} /> Save Changes</>}
                </button>
              )}
            </div>
          </div>
        </form>
      </ModalShell>
    </>
  );
};

export default TaskDetailModal;
