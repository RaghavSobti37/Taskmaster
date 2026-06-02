import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Trash2, Check, RotateCcw } from 'lucide-react';
import { NexusModal, ModalShell, ModalFooter, Button } from './ui';
import { useProjects, useUpdateTask } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory, taskCategoryLabel } from '../constants/taskOptions';
import { useAuth } from '../contexts/AuthContext';
import { canReviewTask } from '../utils/taskReview';
import { resolveTaskId } from '../utils/taskCompletion';
import TaskFormFields from './forms/TaskFormFields';
import { AXIOS_SKIP_TOAST, suppressAutoToasts } from '../lib/notifications';
import { validateTaskTimelineFields, toDateKey } from '../utils/dateValidation';
import { useSystemToast } from '../lib/systemLogBridge';

const TaskDetailModal = ({ isOpen, onClose, task, onTaskUpdated, onTaskDeleted, onUpdate }) => {
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const updateTaskMutation = useUpdateTask();
  const { addToast } = useSystemToast();
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
    dueDateManual: true,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canReview = canReviewTask(task, user);
  const creatorId = task?.createdBy?._id || task?.createdBy;
  const canEditTimeline = canReview || creatorId?.toString() === user?._id?.toString();

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
        dueDateManual: true,
      });
    }
  }, [task]);

  if (!task) return null;

  const notifyUpdate = (data) => {
    if (onTaskUpdated) onTaskUpdated(data);
    if (onUpdate) onUpdate(data);
  };

  const submitUpdate = (reviewAction) => {
    const taskId = resolveTaskId(task);
    if (!taskId) return;

    const payload = {
      title,
      description: desc,
      status: reviewAction ? undefined : formValues.status,
      priority: formValues.priority,
      type: normalizeTaskCategory(formValues.type),
      projectId: formValues.projectId || null,
      workspace: formValues.workspace,
      assignees: formValues.assignees,
      reviewAction,
    };

    if (canEditTimeline) {
      const originalScheduleDate = toDateKey(task.scheduleDate) || '';
      const originalDueDate = toDateKey(task.dueDate) || '';
      const timelineChanged = formValues.scheduleDate !== originalScheduleDate
        || formValues.dueDate !== originalDueDate
        || (formValues.scheduleSlot || 'FULL') !== (task.scheduleSlot || 'FULL');

      if (timelineChanged) {
        const timelineCheck = validateTaskTimelineFields({
          scheduleDate: formValues.scheduleDate,
          dueDate: formValues.dueDate,
        });
        if (!timelineCheck.ok) {
          addToast({ type: 'error', message: timelineCheck.error });
          return;
        }
      }
      payload.scheduleSlot = formValues.scheduleSlot;
      payload.scheduleDate = formValues.scheduleDate || null;
      payload.dueDate = formValues.dueDate || null;
    }

    suppressAutoToasts(5000);
    updateTaskMutation.mutate(
      { id: taskId, data: payload },
      { onSuccess: (data) => notifyUpdate(data) }
    );
    onClose();
  };

  const handleSubmit = (e, reviewAction) => {
    if (e) e.preventDefault();
    submitUpdate(reviewAction);
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
              lockedAssigneeIds={creatorId ? [creatorId] : []}
              mentionSessionKey={isOpen ? task._id : undefined}
              inlineEdit
            />

            {isInReview && canReview && (
              <div className="flex gap-3 py-3 border-t border-amber-500/30">
                <Button type="button" variant="primary" size="sm" onClick={(e) => handleSubmit(e, 'approve')}>
                  <Check size={14} className="mr-1" /> Approve & Close
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={(e) => handleSubmit(e, 'rollback')}>
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
              {!isDone && (
                <button
                  type="submit"
                  disabled={!title}
                  className="bg-[var(--color-action-primary)] text-white px-8 py-2 rounded-[var(--radius-atomic)] font-bold flex items-center gap-2 disabled:opacity-50"
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
