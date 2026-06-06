import { formatTimeSpent } from './timeSpent';

function buildTaskCompletionLogPayload(task, hours, projects = []) {
  const projectId = task.projectId?._id || task.projectId;
  const project = projects.find(
    (p) => p._id === projectId || p._id?.toString() === projectId?.toString()
  );
  const taskId = resolveTaskId(task);

  return {
    action: 'DAILY_LOG',
    targetType: 'Task',
    targetId: taskId,
    details: {
      type: 'TASK_COMPLETION',
      title: task.title,
      timeSpent: formatTimeSpent(hours),
      project: project?.name || 'General',
      projectId: projectId || null,
    },
  };
}

export function resolveTaskId(task) {
  const raw = task?._id?._id || task?._id;
  if (!raw) return null;
  return String(raw);
}

export function canMarkTaskComplete(task) {
  if (!task) return false;
  const id = resolveTaskId(task);
  if (!id || id.startsWith('pending-task-')) return false;
  return task.status !== 'done' && task.status !== 'in-review';
}

export function normalizeCompletionHours(current, hours) {
  const base = Number(current) || 0;
  const added = Number(hours);
  const total = base + (Number.isFinite(added) && added >= 0 ? added : 0);
  return Math.round(total * 60) / 60;
}

export function pendingReviewToast(taskTitle) {
  return {
    title: 'Awaiting approval',
    message: `"${truncateForToast(taskTitle)}" is in review. The person who assigned it must approve before it is marked done.`,
    type: 'info',
  };
}

export function awaitingAssigneeToast(taskTitle) {
  return {
    title: 'Waiting on assignee',
    message: `"${truncateForToast(taskTitle)}" must be completed by the assignee before you can approve it.`,
    type: 'info',
  };
}

/** Server writes daily logs for done and in-review (assignee + reviewer). */
function shouldClientCreateCompletionLog(status) {
  return false;
}

/** Keep toast copy readable — ellipsis long task titles instead of awkward wraps. */
export function truncateForToast(text, maxLen = 48) {
  const cleaned = (text || '').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

export function taskCompletionToast(status, taskTitle) {
  const title = truncateForToast(taskTitle);

  if (status === 'done') {
    return {
      title: 'Task Finished',
      message: `Completed "${title}"`,
      type: 'success',
    };
  }
  if (status === 'in-review') {
    return {
      title: 'Submitted for Review',
      message: `"${title}" sent for approval — your work hours are in daily logs.`,
      type: 'success',
    };
  }
  return {
    title: 'Task Updated',
    message: `"${title}" status: ${status}`,
    type: 'success',
  };
}

export function taskApprovalToast(taskTitle) {
  const title = truncateForToast(taskTitle);
  return {
    title: 'Task Approved',
    message: `"${title}" marked complete. Your review time is logged as [review].`,
    type: 'success',
  };
}
