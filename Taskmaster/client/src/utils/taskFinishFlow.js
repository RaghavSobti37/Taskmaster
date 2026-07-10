import {
  canMarkTaskComplete,
  pendingReviewToast,
  awaitingAssigneeToast,
} from './taskCompletion';
import { resolveTaskFinishIntent } from './taskReview';

/**
 * Resolve how a finish/complete action should proceed for a task.
 * Returns null when the action should be blocked (caller shows toast).
 */
export function resolveTaskFinishFlow(task, user, projects = [], users = []) {
  if (!task || !canMarkTaskComplete(task)) {
    if (task?.status === 'in-review') {
      return { blocked: true, toast: pendingReviewToast(task.title) };
    }
    return { blocked: true };
  }

  const intent = resolveTaskFinishIntent(task, user, projects, users);

  if (intent === 'approve') {
    return { action: 'approve', task };
  }
  if (intent === 'awaiting_assignee') {
    return { blocked: true, toast: awaitingAssigneeToast(task.title) };
  }
  if (intent === 'awaiting_review') {
    return { blocked: true, toast: pendingReviewToast(task.title) };
  }

  return {
    action: 'complete',
    task,
    submitForReview: intent === 'submit_review',
  };
}
