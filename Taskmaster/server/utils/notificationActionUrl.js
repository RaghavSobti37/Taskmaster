/** Build deep-link actionUrl with optional highlight query param */
function buildTaskActionUrl(task, { review = false } = {}) {
  const taskId = task?._id || task?.relatedTaskId;
  const projectId = task?.projectId || task?.relatedProjectId;
  const reviewParam = review ? '&review=1' : '';
  if (projectId && taskId) {
    return `/projects/${projectId}?highlight=${taskId}${reviewParam}`;
  }
  if (taskId) return `/todo?highlight=${taskId}${reviewParam}`;
  if (projectId) return `/projects/${projectId}`;
  return '/todo';
}

function buildLeadActionUrl(leadId) {
  if (!leadId) return '/followups';
  return `/followups?highlight=${leadId}`;
}

module.exports = { buildTaskActionUrl, buildLeadActionUrl };
