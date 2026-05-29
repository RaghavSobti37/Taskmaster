import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Trash2, Check, RotateCcw } from 'lucide-react';
import { NexusModal, ModalShell, ModalFooter, Button } from './ui';
import { globalToast } from '../contexts/ToastContext';
import { useProjects } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory, taskCategoryLabel } from '../constants/taskOptions';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../utils/departmentPermissions';
import TaskFormFields from './forms/TaskFormFields';
import { AXIOS_SKIP_TOAST, suppressAutoToasts } from '../lib/notifications';

const TaskDetailModal = ({ isOpen, onClose, task, onTaskUpdated, onTaskDeleted, onUpdate }) => {
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const [title, setTitle] = useState(task?.title || '');
  const [desc, setDesc] = useState(task?.description || '');
  const [formValues, setFormValues] = useState({
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    type: task?.type || '',
    workspace: task?.workspace || task?.projectId?.workspace || 'General',
    projectId: task?.projectId?._id || task?.projectId || '',
    scheduleSlot: task?.scheduleSlot || 'FULL',
    scheduleDate: task?.scheduleDate ? new Date(task.scheduleDate).toISOString().split('T')[0] : '',
    assignees: task?.assignees?.map((a) => (typeof a === 'object' ? a._id : a)) || [],
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const assignedById = task?.assignments?.[0]?.assignedBy?._id || task?.assignments?.[0]?.assignedBy || task?.assignedBy?._id || task?.assignedBy;
  const canReview = assignedById?.toString() === user?._id?.toString() || isAdminUser(user);
  const canEditTimeline = canReview || task?.createdBy?._id?.toString() === user?._id?.toString();

  React.useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDesc(task.description || '');
      setFormValues({
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        type: normalizeTaskCategory(task.type),
        workspace: task.workspace || task.projectId?.workspace || 'General',
        projectId: task.projectId?._id || task.projectId || '',
        scheduleSlot: task.scheduleSlot || 'FULL',
        scheduleDate: task.scheduleDate ? new Date(task.scheduleDate).toISOString().split('T')[0] : '',
        assignees: task.assignees?.map((a) => (typeof a === 'object' ? a._id : a)) || [],
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      });
    }
  }, [task]);

  if (!task) return null;

  const notifyUpdate = (data) => {
    if (onTaskUpdated) onTaskUpdated(data);
    if (onUpdate) onUpdate(data);
  };

  const handleSubmit = async (e, reviewAction) => {
    if (e) e.preventDefault();
    suppressAutoToasts(5000);
    setLoading(true);
    try {
      const res = await axios.put(
        `/api/tasks/${task._id}`,
        {
          title,
          description: desc,
          status: reviewAction ? undefined : formValues.status,
          priority: formValues.priority,
          type: normalizeTaskCategory(formValues.type),
          workspace: formValues.workspace,
          scheduleSlot: formValues.scheduleSlot,
          scheduleDate: formValues.scheduleDate || null,
          assignees: formValues.assignees,
          dueDate: formValues.dueDate || null,
          reviewAction,
        },
        AXIOS_SKIP_TOAST
      );
      notifyUpdate(res.data);
      onClose();
    } catch (err) {
      globalToast.addToast({ title: 'Error', message: err.response?.data?.error || 'Update failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/tasks/${task._id}`, AXIOS_SKIP_TOAST);
      if (onTaskDeleted) onTaskDeleted(task._id);
      onClose();
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  const isDone = formValues.status === 'done';
  const isInReview = formValues.status === 'in-review';

  return (
    <>
      <NexusModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task?"
        type="danger"
        isConfirm
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
      <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100}>
        <header className="px-5 py-3 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)] shrink-0">
          <div>
            <h3 className="font-black text-xs uppercase tracking-[0.2em]">Edit Task</h3>
            {task.type && (
              <p className="text-[9px] text-[var(--color-text-muted)]">
                {taskCategoryLabel(task.type)} · {task.scheduleSlot || 'FULL'}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg">
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="tm-modal-scroll p-5 md:p-6 space-y-4">
            <TaskFormFields
              values={formValues}
              onChange={setFormValues}
              projects={projects}
              showProject
              showStatus
              disabled={isDone}
              timelineDisabled={!canEditTimeline}
              showTitle
              showDescription
              title={title}
              onTitleChange={setTitle}
              description={desc}
              onDescriptionChange={setDesc}
            />

            {isInReview && canReview && (
              <div className="flex gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                <Button type="button" variant="primary" size="sm" onClick={(e) => handleSubmit(e, 'approve')} disabled={loading}>
                  <Check size={14} className="mr-1" /> Approve & Close
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={(e) => handleSubmit(e, 'rollback')} disabled={loading}>
                  <RotateCcw size={14} className="mr-1" /> Rollback
                </Button>
              </div>
            )}
          </div>

          <ModalFooter className="justify-between">
            {!isDone ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 text-[10px] font-bold uppercase flex items-center gap-1"
              >
                <Trash2 size={14} /> Remove
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-bold text-[var(--color-text-muted)]">
                Close
              </button>
              {!isDone && !isInReview && (
                <button
                  type="submit"
                  disabled={loading || !title}
                  className="bg-[var(--color-action-primary)] text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} /> Save
                </button>
              )}
            </div>
          </ModalFooter>
        </form>
      </ModalShell>
    </>
  );
};

export default TaskDetailModal;
