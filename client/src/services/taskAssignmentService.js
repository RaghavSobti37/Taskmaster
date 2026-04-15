import api from './api';

export const getEntityId = (value) => {
  if (!value) return '';
  return typeof value === 'object' ? value._id || '' : value;
};

export const mapUiPriorityToApiPriority = (priority) => {
  const priorityMap = {
    low: 'normal',
    medium: 'important',
    high: 'urgent',
    normal: 'normal',
    important: 'important',
    urgent: 'urgent'
  };

  return priorityMap[priority] || 'important';
};

export const buildTaskPayload = ({
  title,
  description,
  priority,
  assigneeId,
  currentUserId,
  projectId,
  status = 'todo',
  dueDate
}) => {
  const normalizedAssignee = assigneeId || currentUserId;
  const isPersonal = !normalizedAssignee || normalizedAssignee === currentUserId;

  return {
    title: title?.trim(),
    description: description || '',
    priority: mapUiPriorityToApiPriority(priority),
    assignee: normalizedAssignee,
    isPersonal,
    projectId: projectId || undefined,
    status,
    dueDate: dueDate || undefined
  };
};

export const createAssignedTask = async ({
  title,
  description,
  priority,
  assigneeId,
  currentUserId,
  projectId,
  status,
  dueDate
}) => {
  const payload = buildTaskPayload({
    title,
    description,
    priority,
    assigneeId,
    currentUserId,
    projectId,
    status,
    dueDate
  });

  const { data } = await api.post('/tasks', payload);
  return data;
};

export const splitTasksForUser = (tasks, userId) => {
  return tasks.reduce(
    (acc, task) => {
      const creatorId = getEntityId(task.creator);
      const assigneeId = getEntityId(task.assignee);

      if (creatorId === userId) {
        acc.myTasks.push(task);
      }

      if (assigneeId === userId && creatorId !== userId) {
        acc.assignedToMe.push(task);
      }

      if (creatorId === userId && assigneeId && assigneeId !== userId) {
        acc.assignedToOthers.push(task);
      }

      return acc;
    },
    { myTasks: [], assignedToMe: [], assignedToOthers: [] }
  );
};
