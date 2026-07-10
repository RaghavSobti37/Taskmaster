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
  const id = resolveUserId(ref);
  const fromDirectory = id ? directoryById.get(id) : null;
  if (typeof ref === 'object' && (ref.name || fromDirectory)) {
    const base = fromDirectory || ref;
    return {
      ...base,
      _id: id || base._id,
      name: ref.name || base.name,
      avatar: ref.avatar ?? base.avatar,
      departmentId: base.departmentId || ref.departmentId,
      department: base.department || ref.department,
    };
  }
  if (!id) return null;
  return fromDirectory || (typeof ref === 'object' ? ref : { _id: id, name: 'Unknown' });
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

  const creatorId = resolveUserId(normalized.createdBy);
  const creatorUser = creatorId
    ? resolveUserFromRef(normalized.createdBy, directoryById)
    : null;

  const distinctAssignerIds = new Set();
  for (const assignment of normalized.assignments || []) {
    const assigneeId = resolveUserId(assignment.userId);
    const assignerId = resolveUserId(assignment.assignedBy);
    if (!assigneeId || !assignerId || assignerId === assigneeId) continue;
    distinctAssignerIds.add(assignerId);
  }
  const showAssignerAttribution = distinctAssignerIds.size > 1;

  const ids = (assigneeIds?.length ? assigneeIds : [...assignmentByUserId.keys()]).map(String);
  const uniqueIds = [...new Set(ids)].filter((id) => id !== creatorId);

  const assigneeRows = uniqueIds.map((userId) => {
    const assignment = assignmentByUserId.get(userId);
    const user = assignment
      ? resolveUserFromRef(assignment.user || assignment.userId, directoryById)
      : directoryById.get(userId);
    const assigner = assignment?.assignedBy
      ? resolveUserFromRef(assignment.assignedBy, directoryById)
      : null;
    const assignerId = resolveUserId(assigner);
    const isSelfAssigned = !assignerId || assignerId === userId;
    const showBy = showAssignerAttribution && !isSelfAssigned;

    return {
      userId,
      user,
      name: user?.name || 'Unknown',
      avatar: user?.avatar,
      department: resolveUserDepartmentName(user),
      role: 'assignee',
      roleLabel: 'Assignee',
      assignerName: showBy ? assigner?.name : null,
      assignerLabel: showBy ? 'Assigned by' : null,
    };
  });

  if (!creatorId) return assigneeRows;

  const creatorRow = {
    userId: creatorId,
    user: creatorUser,
    name: creatorUser?.name || 'Unknown',
    avatar: creatorUser?.avatar,
    department: resolveUserDepartmentName(creatorUser),
    role: 'creator',
    roleLabel: 'Creator',
    createdAt: normalized.createdAt || null,
    assignerName: null,
    assignerLabel: null,
  };

  return [creatorRow, ...assigneeRows];
}
