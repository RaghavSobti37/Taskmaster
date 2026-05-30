export function buildTaskCompletionLogPayload(task, hours, projects = []) {
  const projectId = task.projectId?._id || task.projectId;
  const project = projects.find(
    (p) => p._id === projectId || p._id?.toString() === projectId?.toString()
  );

  return {
    action: 'DAILY_LOG',
    targetType: 'Task',
    targetId: task._id,
    details: {
      type: 'TASK_COMPLETION',
      title: task.title,
      timeSpent: `${hours}h`,
      project: project?.name || 'General',
      projectId: projectId || null,
    },
  };
}

/** Server finalizeTaskCompletion already writes DAILY_LOG when status is done. */
export function shouldClientCreateCompletionLog(status) {
  return status !== 'done';
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
      title: 'Task Finished (+20 XP)',
      message: `Completed "${title}"`,
      type: 'success',
    };
  }
  if (status === 'in-review') {
    return {
      title: 'Submitted for Review',
      message: `"${title}" sent for approval — time logged to daily logs.`,
      type: 'success',
    };
  }
  return {
    title: 'Task Updated',
    message: `"${title}" status: ${status}`,
    type: 'success',
  };
}
