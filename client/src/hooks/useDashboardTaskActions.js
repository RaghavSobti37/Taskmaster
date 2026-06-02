import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../lib/notifications';
import {
  taskCompletionToast,
  taskApprovalToast,
  resolveTaskId,
  canMarkTaskComplete,
  normalizeCompletionHours,
  pendingReviewToast,
} from '../utils/taskCompletion';
import { resolveTaskFinishIntent } from '../utils/taskReview';
import { updateAllTaskQueries } from '../utils/taskCache';
import { invalidateTaskDomain, invalidateReviewTasks } from '../lib/queryInvalidation';

export function useDashboardTaskActions({ user, projects, users }) {
  const queryClient = useQueryClient();
  const { addToast } = useSystemToast();
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completionSubmitForReview, setCompletionSubmitForReview] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [approvingReviewId, setApprovingReviewId] = useState(null);

  const handleApproveReview = useCallback(
    async (task) => {
      const taskId = resolveTaskId(task);
      if (!taskId) return;
      suppressAutoToasts(5000);
      setApprovingReviewId(taskId);
      try {
        const taskRes = await axios.put(
          `/api/tasks/${taskId}`,
          { reviewAction: 'approve' },
          AXIOS_SKIP_TOAST
        );
        addToast({
          ...taskApprovalToast(task.title),
          duration: 5000,
          module: MODULE.PROJECTS,
        });
        updateAllTaskQueries(queryClient, (list) =>
          (list || []).map((t) => (resolveTaskId(t) === taskId ? { ...t, ...taskRes.data } : t))
        );
        invalidateReviewTasks(queryClient);
        invalidateTaskDomain(queryClient);
        queryClient.invalidateQueries({ queryKey: ['logs'] });
      } catch (err) {
        addToast({
          title: 'Approval Failed',
          message: err.response?.data?.error || err.response?.data?.message || 'Could not approve task.',
          type: 'error',
          module: MODULE.PROJECTS,
        });
      } finally {
        setApprovingReviewId(null);
      }
    },
    [queryClient, addToast]
  );

  const handleCompleteSubmit = useCallback(
    async (task, hours) => {
      suppressAutoToasts(5000);
      const taskId = resolveTaskId(task);
      if (!taskId) {
        addToast({
          title: 'Error',
          message: 'Invalid task. Refresh and try again.',
          type: 'error',
          module: MODULE.PROJECTS,
        });
        return;
      }
      setCompletingTaskId(taskId);
      setTaskToComplete(null);
      try {
        const taskRes = await axios.put(
          `/api/tasks/${taskId}`,
          { status: 'done', actualHours: normalizeCompletionHours(task.actualHours, hours) },
          AXIOS_SKIP_TOAST
        );
        const toast = taskCompletionToast(taskRes.data?.status, task.title);
        addToast({ ...toast, duration: 5000, module: MODULE.PROJECTS });
        updateAllTaskQueries(queryClient, (tasks) =>
          (tasks || []).map((t) => (resolveTaskId(t) === taskId ? { ...t, ...taskRes.data } : t))
        );
        invalidateTaskDomain(queryClient);
        queryClient.invalidateQueries({ queryKey: ['logs'] });
      } catch (err) {
        addToast({
          title: 'Error',
          message: err.response?.data?.error || err.response?.data?.message || 'Failed',
          type: 'error',
          module: MODULE.PROJECTS,
        });
      } finally {
        setCompletingTaskId(null);
      }
    },
    [queryClient, addToast]
  );

  const handleCompleteRequest = useCallback(
    (task) => {
      const intent = resolveTaskFinishIntent(task, user, projects, users);
      if (intent === 'approve') {
        handleApproveReview(task);
        return;
      }
      if (intent === 'awaiting_review' || !canMarkTaskComplete(task)) {
        if (task?.status === 'in-review') {
          addToast({ ...pendingReviewToast(task.title), module: MODULE.PROJECTS });
        }
        return;
      }
      setCompletionSubmitForReview(intent === 'submit_review');
      setTaskToComplete(task);
    },
    [user, projects, users, addToast, handleApproveReview]
  );

  return {
    taskToComplete,
    setTaskToComplete,
    completionSubmitForReview,
    completingTaskId,
    approvingReviewId,
    handleCompleteRequest,
    handleCompleteSubmit,
    handleApproveReview,
  };
}
