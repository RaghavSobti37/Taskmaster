import React, { useMemo, useState, useRef } from 'react';
import axios from 'axios';
import { CheckCircle2, Trash2, RotateCcw } from 'lucide-react';
import { Button, Spinner } from './ui';
import { NexusModal, ModalShell, ModalFooter } from './ui/modals';;
import { useProjects, useUpdateTask, useUserDirectory, useTask } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory } from '../constants/taskOptions';
import { useAuth } from '../contexts/AuthContext';
import {
  canReviewTask,
  canRollbackTask,
  canUserApproveReview,
  getTaskAssignedBy,
  displayPersonName,
  getTaskAssignments,
} from '../utils/taskReview';
import TaskCompletionFlash from './tasks/TaskCompletionFlash';
import TaskReviewActions from './tasks/TaskReviewActions';
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
import { hasUnsavedTaskFields } from '../utils/taskFormDirty';

function formValuesFromTask(task) {
  return {
    status: task?.status || 'todo',
    progress: task?.progress ?? progressForTaskStatus(task?.status || 'todo'),
    priority: task?.priority || 'medium',
    type: normalizeTaskCategory(task?.type),
    workspace: task?.workspace || task?.projectId?.workspace || 'General',
    projectId: task?.projectId?._id || task?.projectId || '',
    scheduleSlot: task?.scheduleSlot || 'FULL',
    scheduleDate: task?.scheduleDate ? new Date(task.scheduleDate).toISOString().split('T')[0] : '',
    assignees: task?.assignees?.map((a) => (typeof a === 'object' ? a._id : a)) || [],
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    dueDateManual: true,
  };
}

const TaskDetailModal = ({ isOpen, onClose, task, onTaskUpdated, onTaskDeleted, onUpdate, onFinishRequest }) => {
  const { user } = useAuth();
  const taskId = resolveTaskId(task);
  const { data: fetchedTask, isFetching: isFetchingTask } = useTask(taskId, { enabled: isOpen && !!taskId });
  const activeTask = fetchedTask ?? task;
  const isHydrating = isOpen && !!taskId && !fetchedTask && isFetchingTask;
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
  const [showRollbackForm, setShowRollbackForm] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showCompletionFlash, setShowCompletionFlash] = useState(false);
  const [pendingFinishAfterSave, setPendingFinishAfterSave] = useState(false);
  const pendingFinishRef = useRef(false);
  const isSaving = updateTaskMutation.isPending;

  const setPendingFinish = (value) => {
    pendingFinishRef.current = value;
    setPendingFinishAfterSave(value);
  };

  const canReview = canReviewTask(activeTask, user);
  const canRollback = canRollbackTask(activeTask, user);
  const canApproveReview = canUserApproveReview(user, getTaskAssignments(activeTask));
  const assigner = getTaskAssignedBy(activeTask);
  const creatorId = activeTask?.createdBy?._id || activeTask?.createdBy;
  const isCreator = creatorId?.toString() === user?._id?.toString();
  const canEditTimeline = canReview || isCreator;
  const isDone = formValues.status === 'done';
  const formLocked = isDone;

  const isDirty = hasUnsavedTaskFields(activeTask, {
    title,
    desc,
    formValues,
    directoryUsers,
    creatorId,
  });

  const requestTaskFinish = () => {
    if (!onFinishRequest) {
      addToast({
        type: 'warning',
        title: 'Completion unavailable',
        message: 'Mark this task done from the project task list.',
      });
      return;
    }
    onFinishRequest({ ...(displayTask ?? task), title: title.trim() || task.title });
  };

  const handleStatusChange = (status, progress) => {
    const currentStatus = displayTask?.status ?? task.status;
    if (status === 'done' && currentStatus !== 'done') {
      if (isDirty) {
        setPendingFinish(true);
        addToast({
          type: 'warning',
          title: 'Save first',
          message: 'Save your changes — completion will open right after.',
        });
        return;
      }
      requestTaskFinish();
      return;
    }
    setPendingFinish(false);
    setFormValues((v) => ({ ...v, status, progress }));
  };

  React.useEffect(() => {
    if (!isOpen || !activeTask) return;
    setDisplayTask(activeTask);
    setTitle(activeTask.title || '');
    setDesc('');
    setShowRollbackForm(false);
    setRollbackReason('');
    setShowCompletionFlash(false);
    setPendingFinish(false);
    setFormValues(formValuesFromTask(activeTask));
  }, [isOpen, taskId, fetchedTask, activeTask]);

  const projectName = useMemo(() => {
    const id = formValues.projectId;
    if (!id) return activeTask?.projectId?.name || 'No project';
    const match = projects.find((p) => String(p._id) === String(id));
    return match?.name || activeTask?.projectId?.name || 'Unknown project';
  }, [formValues.projectId, projects, activeTask?.projectId?.name]);

  if (!task) return null;

  const resolvedTask = displayTask ?? activeTask;

  const notifyUpdate = (data) => {
    if (onTaskUpdated) onTaskUpdated(data);
    if (onUpdate) onUpdate(data);
  };

  const postActivityMessage = async (taskId, body) => {
    if (!body?.trim()) return;
    await axios.post(`/api/tasks/${taskId}/activity`, { body: body.trim() }, AXIOS_SKIP_TOAST);
  };

  const submitUpdate = (reviewAction) => {
    const taskId = resolveTaskId(task);
    if (!taskId) return;

    if (reviewAction === 'rollback' && !rollbackReason.trim()) {
      addToast({ type: 'error', message: 'Please provide a reason for rollback.' });
      return;
    }

    const messageDraft = desc.trim();
    const payload = reviewAction
      ? {
          reviewAction,
          ...(reviewAction === 'rollback' ? { description: rollbackReason.trim() } : {}),
        }
      : {
          title,
          status: formValues.status,
          progress: formValues.progress,
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
        };

    if (!reviewAction && canEditTimeline) {
      const originalScheduleDate = toDateKey(activeTask.scheduleDate) || '';
      const originalDueDate = toDateKey(activeTask.dueDate) || '';
      const timelineChanged = formValues.scheduleDate !== originalScheduleDate
        || formValues.dueDate !== originalDueDate
        || (formValues.scheduleSlot || 'FULL') !== (activeTask.scheduleSlot || 'FULL');

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
        onSuccess: async (data) => {
          if (reviewAction === 'approve') {
            setShowCompletionFlash(true);
            setDesc('');
            notifyUpdate(data);
            setTimeout(() => onClose(), 1200);
            return;
          }

          let nextTask = data;
          if (messageDraft) {
            try {
              await postActivityMessage(taskId, messageDraft);
            } catch (err) {
              console.error('Task message post failed:', err);
              addToast({
                type: 'error',
                message: err.response?.data?.error || 'Task saved but message failed to post.',
              });
            }
          }

          setDesc('');
          setShowRollbackForm(false);
          setRollbackReason('');
          notifyUpdate(nextTask);
          setDisplayTask(nextTask);

          const shouldFinish = pendingFinishRef.current;
          if (shouldFinish) {
            setPendingFinish(false);
            if (onFinishRequest) {
              onFinishRequest(nextTask);
              return;
            }
            addToast({
              type: 'warning',
              title: 'Completion unavailable',
              message: 'Changes saved. Reopen the task to mark it done from the list.',
            });
            return;
          }
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
          {isHydrating && (
            <div className="flex items-center justify-center gap-2 px-6 py-3 text-sm text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
              <Spinner size="sm" />
              Loading task details…
            </div>
          )}
          <div className={`flex flex-1 min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden tm-modal-scroll ${isHydrating ? 'opacity-60 pointer-events-none' : ''}`}>
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
                  <>
                  <TaskCompletionFlash show={showCompletionFlash} />
                  {pendingFinishAfterSave && !isDone && (
                    <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      Save your changes to open the completion dialog.
                    </p>
                  )}
                  <TaskMessageComposeSection
                    message={desc}
                    onMessageChange={setDesc}
                    disabled={formLocked}
                    mentionSessionKey={isOpen ? task._id : undefined}
                    inlineEdit={false}
                    status={formValues.status}
                    onStatusChange={handleStatusChange}
                    statusDisabled={formLocked || isInReview}
                  />
                  </>
                }
              />

              <TaskReviewActions
                isInReview={isInReview}
                isDone={isDone}
                canReview={canReview}
                canRollback={canRollback}
                canApproveReview={canApproveReview}
                assignerName={displayPersonName(assigner, 'assigner')}
                isSaving={isSaving || isHydrating}
                showRollbackForm={showRollbackForm}
                rollbackReason={rollbackReason}
                onRollbackReasonChange={setRollbackReason}
                onShowRollbackForm={() => setShowRollbackForm(true)}
                onHideRollbackForm={() => { setShowRollbackForm(false); setRollbackReason(''); }}
                onApprove={(e) => handleSubmit(e, 'approve')}
                onConfirmRollback={(e) => handleSubmit(e, 'rollback')}
              />
            </div>

            <div className="w-full lg:w-[min(400px,36vw)] shrink-0 flex flex-col min-h-[220px] max-h-[min(42vh,360px)] lg:max-h-none lg:min-h-0 border-t lg:border-t-0 border-[var(--color-bg-border)]">
              <TaskHistoryPanel task={resolvedTask} enabled={isOpen} />
            </div>
          </div>

          <ModalFooter className="justify-between px-6 py-4">
            {!isDone ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 uppercase tracking-wide"
              >
                <Trash2 size={14} /> Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-3 ml-auto">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving || isDeleting}>
                Close
              </Button>
              {!isDone && (
                <Button
                  type="submit"
                  disabled={!title || isSaving || (!isDirty && !pendingFinishAfterSave)}
                >
                  {isSaving ? <Spinner size="sm" className="text-white" /> : <CheckCircle2 size={18} />}
                  {isSaving ? 'Saving...' : (pendingFinishAfterSave ? 'Save & Continue' : 'Save')}
                </Button>
              )}
              {isDone && canRollback && !showRollbackForm && (
                <Button
                  type="button"
                  onClick={() => setShowRollbackForm(true)}
                  disabled={isSaving || isHydrating}
                  className="bg-amber-500 hover:bg-amber-400 text-[var(--color-bg-primary)] border-amber-500"
                >
                  <RotateCcw size={16} />
                  Rollback Task
                </Button>
              )}
            </div>
          </ModalFooter>
        </form>
      </ModalShell>
    </>
  );
};

export default TaskDetailModal;
