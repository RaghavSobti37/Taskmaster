import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Trash2, Check, RotateCcw } from 'lucide-react';
import { Button, Spinner } from './ui';
import { NexusModal, ModalShell, ModalFooter } from './ui/modals';;
import { useProjects, useUpdateTask, useUserDirectory } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory } from '../constants/taskOptions';
import { useAuth } from '../contexts/AuthContext';
import { canReviewTask, canRollbackTask } from '../utils/taskReview';
import { resolveTaskId } from '../utils/taskCompletion';
import TaskFormFields from './forms/TaskFormFields';
import { AXIOS_SKIP_TOAST, suppressAutoToasts } from '../lib/notifications';
import { validateTaskTimelineFields, toDateKey } from '../utils/dateValidation';
import { useSystemToast } from '../lib/systemLogBridge';
import TaskHistoryPanel from './tasks/TaskHistoryPanel';
import TaskMessageComposeSection from './tasks/TaskMessageComposeSection';
import TaskDetailModalHeader from './tasks/TaskDetailModalHeader';
import { progressForTaskStatus } from '../utils/taskStatusButtons';
import { mergeMentionedUserIdsIntoAssignees } from '../utils/mentionTokens';

const TaskDetailModal = ({ isOpen, onClose, task, onTaskUpdated, onTaskDeleted, onUpdate }) => {
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: directoryUsers = [] } = useUserDirectory(isOpen);
  const updateTaskMutation = useUpdateTask();
  const [displayTask, setDisplayTask] = useState(task);
  const { addToast } = useSystemToast();
  const [title, setTitle] = useState(task?.title || '');
  const [desc, setDesc] = useState(task?.description || '');
  const [formValues, setFormValues] = useState({
    status: task?.status || 'todo',
    progress: task?.progress ?? 0,
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
  const [isDeleting, setIsDeleting] = useState(false);
  const isSaving = updateTaskMutation.isPending;

  const canReview = canReviewTask(task, user);
  const canRollback = canRollbackTask(task, user);
  const creatorId = task?.createdBy?._id || task?.createdBy;
  const isCreator = creatorId?.toString() === user?._id?.toString();
  const canEditTimeline = canReview || isCreator;
  const isDone = formValues.status === 'done';
  const canEditDoneStatus = isDone && canRollback;

  React.useEffect(() => {
    if (task) {
      setDisplayTask(task);
      setTitle(task.title || '');
      setDesc('');
      setFormValues({
        status: task.status || 'todo',
        progress: task.progress ?? progressForTaskStatus(task.status || 'todo'),
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

  const projectName = useMemo(() => {
    const id = formValues.projectId;
    if (!id) return task?.projectId?.name || 'No project';
    const match = projects.find((p) => String(p._id) === String(id));
    return match?.name || task?.projectId?.name || 'Unknown project';
  }, [formValues.projectId, projects, task?.projectId?.name]);

  if (!task) return null;

  const resolvedTask = displayTask ?? task;

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
      progress: reviewAction ? undefined : formValues.progress,
      priority: formValues.priority,
      type: normalizeTaskCategory(formValues.type),
      projectId: formValues.projectId || null,
      workspace: formValues.workspace,
      assignees: mergeMentionedUserIdsIntoAssignees(
        formValues.assignees,
        directoryUsers,
        title,
        desc
      ).filter((id) => id !== creatorId?.toString()),
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
      {
        onSuccess: (data) => {
          setDesc('');
          notifyUpdate(data);
          onClose();
        },
      }
    );
  };

  const handleSubmit = (e, reviewAction) => {
    if (e) e.preventDefault();
    submitUpdate(reviewAction);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/tasks/${task._id}`, AXIOS_SKIP_TOAST);
      if (onTaskDeleted) onTaskDeleted(task._id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Delete task error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isInReview = formValues.status === 'in-review';
  const formLocked = isDone && !canEditDoneStatus;

  return (
    <>
      <NexusModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task?"
        type="danger"
        isConfirm
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
      />
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        size="task"
        zIndex={100}
        panelClassName="!max-h-[min(92vh,960px)] !w-[min(calc(100vw-1rem),1400px)] sm:!w-[min(calc(100vw-2rem),1400px)]"
      >
        <TaskDetailModalHeader
          onClose={onClose}
          workspace={formValues.workspace || task.workspace || 'General'}
          projectName={projectName}
          priority={formValues.priority}
          task={resolvedTask}
          assigneeIds={formValues.assignees}
          onAssigneesChange={(assignees) => setFormValues((v) => ({ ...v, assignees }))}
          directoryUsers={directoryUsers}
          lockedAssigneeIds={creatorId ? [creatorId] : []}
          teamEditable={!formLocked}
          dueDate={formValues.dueDate}
          scheduleDate={formValues.scheduleDate}
          taskStatus={formValues.status}
          onDueDateChange={(dueDate) => setFormValues((v) => ({ ...v, dueDate, dueDateManual: true }))}
          dueDateDisabled={formLocked || !canEditTimeline}
        />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden tm-modal-scroll">
            <div className="flex-1 min-w-0 shrink-0 lg:shrink lg:min-h-0 lg:overflow-y-auto lg:tm-modal-scroll p-4 sm:p-5 md:p-6 lg:p-7 space-y-5 border-b lg:border-b-0 lg:border-r border-[var(--color-bg-border)]">
              <TaskFormFields
                values={formValues}
                onChange={setFormValues}
                projects={projects}
                showProject
                showAssignees={false}
                showPriority={false}
                showStatus={false}
                disabled={formLocked}
                timelineDisabled={!canEditTimeline}
                showTitle
                showDescription={false}
                title={title}
                onTitleChange={setTitle}
                lockedAssigneeIds={creatorId ? [creatorId] : []}
                mentionSessionKey={isOpen ? task._id : undefined}
                inlineEdit={false}
                collapseCategoryWhenSelected
                showDueDateInForm={false}
                afterTitle={
                  <TaskMessageComposeSection
                    message={desc}
                    onMessageChange={setDesc}
                    disabled={formLocked}
                    mentionSessionKey={isOpen ? task._id : undefined}
                    inlineEdit={false}
                    status={formValues.status}
                    onStatusChange={(status, progress) => setFormValues((v) => ({ ...v, status, progress }))}
                    statusDisabled={formLocked}
                  />
                }
              />

              {isInReview && (canReview || canRollback) && (
                <div className="flex flex-wrap gap-3 py-3 border-t border-amber-500/30">
                  {canReview && (
                    <Button type="button" variant="primary" size="sm" disabled={isSaving} onClick={(e) => handleSubmit(e, 'approve')}>
                      <Check size={14} className="mr-1" /> {isSaving ? 'Saving...' : 'Approve & Close'}
                    </Button>
                  )}
                  {canRollback && (
                    <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={(e) => handleSubmit(e, 'rollback')}>
                      <RotateCcw size={14} className="mr-1" /> Rollback
                    </Button>
                  )}
                </div>
              )}

              {canEditDoneStatus && (
                <p className="text-xs text-[var(--color-text-muted)] py-2 border-t border-[var(--color-bg-border)]">
                  Change status above to reopen or move this task — then Save. Creators may also mark tasks done without waiting for assignees.
                </p>
              )}
            </div>

            <div className="w-full lg:w-[min(400px,36vw)] shrink-0 flex flex-col min-h-[220px] max-h-[min(42vh,360px)] lg:max-h-none lg:min-h-0 border-t lg:border-t-0 border-[var(--color-bg-border)]">
              <TaskHistoryPanel task={displayTask || task} enabled={isOpen} />
            </div>
          </div>

          <ModalFooter className="justify-between px-6 py-4">
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
              <button type="button" onClick={onClose} disabled={isSaving || isDeleting} className="px-6 py-2 text-sm font-bold text-[var(--color-text-muted)] disabled:opacity-50">
                Close
              </button>
              {(!isDone || canEditDoneStatus) && (
                <button
                  type="submit"
                  disabled={!title || isSaving}
                  className="bg-[var(--color-action-primary)] text-white px-8 py-2 rounded-[var(--radius-atomic)] font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Spinner size="sm" className="text-white" /> : <CheckCircle2 size={18} />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              )}
              {isDone && !canEditDoneStatus && (
                <span className="text-xs text-[var(--color-text-muted)]">Completed</span>
              )}
            </div>
          </ModalFooter>
        </form>
      </ModalShell>
    </>
  );
};

export default TaskDetailModal;
