import { normalizeTask } from './normalizeTask';

function resolveUserId(ref) {
  if (ref == null) return null;
  if (typeof ref === 'string') return ref;
  const id = ref._id || ref.userId?._id || ref.userId;
  return id != null ? String(id) : null;
}

export function resolveUserDepartmentName(user) {
  if (!user) return '—';
  if (user.departmentId?.name) return user.departmentId.name;
  if (typeof user.department === 'string' && user.department) return user.department;
  return '—';
}

function resolveUserFromRef(ref, directoryById) {
  if (!ref) return null;
  if (typeof ref === 'object' && ref.name) return ref;
  const id = resolveUserId(ref);
  if (!id) return null;
  return directoryById.get(id) || (typeof ref === 'object' ? ref : { _id: id, name: 'Unknown' });
}

/**
 * Rows for task modal header: avatar, name, department, assignee vs assigner role.
 */
export function buildTaskAssigneeRows(task, assigneeIds = [], directoryUsers = []) {
  if (!task) return [];

  const directoryById = new Map(
    (directoryUsers || []).map((u) => [String(u._id || u.user?._id), u.user || u])
  );

  const normalized = normalizeTask(task);
  if (!normalized) return [];
  const assignmentByUserId = new Map();
  for (const assignment of normalized.assignments || []) {
    const uid = resolveUserId(assignment.userId);
    if (uid) assignmentByUserId.set(uid, assignment);
  }

  const ids = (assigneeIds?.length ? assigneeIds : [...assignmentByUserId.keys()]).map(String);
  const uniqueIds = [...new Set(ids)];

  return uniqueIds.map((userId) => {
    const assignment = assignmentByUserId.get(userId);
    const user = assignment
      ? resolveUserFromRef(assignment.user || assignment.userId, directoryById)
      : directoryById.get(userId);
    const assigner = assignment?.assignedBy
      ? resolveUserFromRef(assignment.assignedBy, directoryById)
      : null;
    const assignerId = resolveUserId(assigner);
    const isSelfAssigned = !assignerId || assignerId === userId;

    return {
      userId,
      user,
      name: user?.name || 'Unknown',
      avatar: user?.avatar,
      department: resolveUserDepartmentName(user),
      role: 'assignee',
      roleLabel: 'Assignee',
      assignerName: isSelfAssigned ? null : assigner?.name,
      assignerLabel: isSelfAssigned ? null : 'Assigned by',
    };
  });
}
