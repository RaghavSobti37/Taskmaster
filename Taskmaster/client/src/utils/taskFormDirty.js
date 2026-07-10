import { normalizeTaskCategory } from '../constants/taskOptions';
import { toDateKey } from './dateValidation';
import { mergeMentionedUserIdsIntoAssignees } from './mentionTokens';

function normalizeAssigneeIds(assignees = []) {
  return assignees
    .map((a) => (typeof a === 'object' ? a._id : a))
    .filter(Boolean)
    .map(String)
    .sort();
}

export function hasUnsavedTaskFields(task, { title, desc, formValues, directoryUsers = [], creatorId }) {
  if (!task) return false;

  const baselineTitle = (task.title || '').trim();
  if ((title || '').trim() !== baselineTitle) return true;
  if ((desc || '').trim().length > 0) return true;

  const baselineStatus = task.status || 'todo';
  if ((formValues?.status || 'todo') !== baselineStatus) return true;

  const baselinePriority = task.priority || 'medium';
  if ((formValues?.priority || 'medium') !== baselinePriority) return true;

  const baselineType = normalizeTaskCategory(task.type);
  if (normalizeTaskCategory(formValues?.type) !== baselineType) return true;

  const baselineWorkspace = task.workspace || task.projectId?.workspace || 'General';
  if ((formValues?.workspace || 'General') !== baselineWorkspace) return true;

  const baselineProjectId = String(task.projectId?._id || task.projectId || '');
  const nextProjectId = String(formValues?.projectId || '');
  if (nextProjectId !== baselineProjectId) return true;

  const baselineScheduleSlot = task.scheduleSlot || 'FULL';
  if ((formValues?.scheduleSlot || 'FULL') !== baselineScheduleSlot) return true;

  const baselineScheduleDate = toDateKey(task.scheduleDate) || '';
  const nextScheduleDate = formValues?.scheduleDate || '';
  if (nextScheduleDate !== baselineScheduleDate) return true;

  const baselineDueDate = toDateKey(task.dueDate) || '';
  const nextDueDate = formValues?.dueDate || '';
  if (nextDueDate !== baselineDueDate) return true;

  const baselineAssignees = normalizeAssigneeIds(
    (task.assignees || []).filter((id) => String(typeof id === 'object' ? id._id : id) !== String(creatorId || ''))
  );
  const nextAssignees = normalizeAssigneeIds(
    mergeMentionedUserIdsIntoAssignees(
      formValues?.assignees || [],
      directoryUsers,
      title,
      desc
    ).filter((id) => String(id) !== String(creatorId || ''))
  );
  if (baselineAssignees.join(',') !== nextAssignees.join(',')) return true;

  return false;
}
