import { resolveTaskSpan } from './scheduleTaskDates';

export { resolveTaskSpan };

export function getTaskPlacement(task, dateKeys) {
  if (dateKeys.length === 0) return null;

  const span = resolveTaskSpan(task);
  if (!span) return null;

  const visibleStart = dateKeys[0];
  const visibleEnd = dateKeys[dateKeys.length - 1];
  if (span.end < visibleStart || span.start > visibleEnd) return null;

  const clippedStart = span.start < visibleStart ? visibleStart : span.start;
  const clippedEnd = span.end > visibleEnd ? visibleEnd : span.end;

  const startIndex = dateKeys.indexOf(clippedStart);
  const endIndex = dateKeys.indexOf(clippedEnd);
  if (startIndex < 0 || endIndex < 0) return null;

  const dayCount = endIndex - startIndex + 1;

  if (dayCount === 1) {
    const slot = task.scheduleSlot || 'FULL';
    if (slot === 'AM') return { startCol: startIndex * 2, span: 1 };
    if (slot === 'PM') return { startCol: startIndex * 2 + 1, span: 1 };
    return { startCol: startIndex * 2, span: 2 };
  }

  return { startCol: startIndex * 2, span: dayCount * 2 };
}

function rangesOverlap(a, b) {
  const aEnd = a.startCol + a.span - 1;
  const bEnd = b.startCol + b.span - 1;
  return a.startCol <= bEnd && b.startCol <= aEnd;
}

function assignPlacedLanes(placed) {
  const lanes = [];
  for (const item of placed) {
    let laneIndex = 0;
    while (laneIndex < lanes.length) {
      const overlaps = lanes[laneIndex].some((existing) => rangesOverlap(existing, item));
      if (!overlaps) break;
      laneIndex += 1;
    }
    if (!lanes[laneIndex]) lanes[laneIndex] = [];
    lanes[laneIndex].push(item);
  }
  return lanes;
}

export function assignTaskLanes(tasks, dateKeys) {
  const placed = (tasks || [])
    .map((task) => {
      const placement = getTaskPlacement(task, dateKeys);
      if (!placement) return null;
      return { task, coAssignees: [], ...placement };
    })
    .filter(Boolean);
  return assignPlacedLanes(placed);
}

export function assignEntryLanes(entries, dateKeys) {
  const placed = (entries || [])
    .map(({ task, coAssignees = [] }) => {
      const placement = getTaskPlacement(task, dateKeys);
      if (!placement) return null;
      return { task, coAssignees, ...placement };
    })
    .filter(Boolean);
  return assignPlacedLanes(placed);
}

/** Shared tasks render on one row: current user, else first in cluster order, else lowest id. */
export function pickPrimaryAssignee(assigneesInCluster, memberOrderIds, currentUserId) {
  if (!assigneesInCluster?.length) return null;
  if (assigneesInCluster.length === 1) return assigneesInCluster[0];

  const uid = currentUserId?.toString() || null;
  if (uid && assigneesInCluster.includes(uid)) return uid;

  for (const id of memberOrderIds) {
    if (assigneesInCluster.includes(id)) return id;
  }

  return [...assigneesInCluster].sort()[0];
}

export function memberByIdFromMembers(members) {
  return new Map((members || []).map((m) => [m._id?.toString(), m]).filter(([id]) => id));
}

function resolveAssigneeUser(assignment, memberById) {
  const raw = assignment.userId;
  const id = (raw?._id || raw)?.toString();
  if (!id) return null;

  if (raw?._id && (raw.name || raw.avatar)) return raw;

  const fromDirectory = memberById?.get(id);
  if (fromDirectory) return fromDirectory;

  if (typeof raw === 'object' && raw !== null) {
    return { _id: id, name: raw.name, avatar: raw.avatar };
  }

  return { _id: id };
}

export function coAssigneesFromTask(task, ownerId, memberById) {
  const owner = ownerId?.toString();
  return (task.assignments || [])
    .map((a) => {
      const user = resolveAssigneeUser(a, memberById);
      const id = user?._id?.toString();
      if (!id || id === owner) return null;
      return user;
    })
    .filter(Boolean);
}

export function buildTasksByUser(tasks) {
  const map = new Map();
  for (const task of tasks || []) {
    for (const assignment of task.assignments || []) {
      const userId = (assignment.userId?._id || assignment.userId)?.toString();
      if (!userId) continue;
      if (!map.has(userId)) map.set(userId, []);
      map.get(userId).push(task);
    }
  }
  return map;
}

export function getTaskAssigneeIds(task) {
  return (task.assignments || [])
    .map((a) => (a.userId?._id || a.userId)?.toString())
    .filter(Boolean);
}

export function flattenDepartmentMembers(departments) {
  const seen = new Set();
  const members = [];
  for (const group of departments || []) {
    for (const member of group.users || []) {
      const id = member._id?.toString();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push(member);
    }
  }
  return members;
}

function shareCountBetween(a, b, tasks, dateKeys) {
  let count = 0;
  for (const task of tasks || []) {
    if (!getTaskPlacement(task, dateKeys)) continue;
    const ids = new Set(getTaskAssigneeIds(task));
    if (ids.has(a) && ids.has(b)) count += 1;
  }
  return count;
}

export function orderClusterMembers(members, tasks, dateKeys) {
  if (members.length <= 1) return members;

  const memberIds = members.map((m) => m._id.toString());
  const byId = new Map(members.map((m) => [m._id.toString(), m]));
  const remaining = new Set(memberIds);

  let start = memberIds[0];
  let maxShare = -1;
  for (const id of memberIds) {
    let total = 0;
    for (const other of memberIds) {
      if (other !== id) total += shareCountBetween(id, other, tasks, dateKeys);
    }
    if (total > maxShare) {
      maxShare = total;
      start = id;
    }
  }

  const ordered = [byId.get(start)];
  remaining.delete(start);

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1]._id.toString();
    let best = null;
    let bestScore = -1;
    for (const id of remaining) {
      const score = shareCountBetween(last, id, tasks, dateKeys);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    if (!best) best = [...remaining][0];
    ordered.push(byId.get(best));
    remaining.delete(best);
  }

  return ordered;
}

export function clusterMembersBySharedTasks(members, tasks, dateKeys) {
  if (!members.length) return [];

  const memberById = new Map(members.map((m) => [m._id.toString(), m]));
  const adj = new Map();

  const addEdge = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };

  for (const task of tasks || []) {
    if (!getTaskPlacement(task, dateKeys)) continue;
    const ids = getTaskAssigneeIds(task).filter((id) => memberById.has(id));
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        addEdge(ids[i], ids[j]);
      }
    }
  }

  const visited = new Set();
  const clusters = [];

  for (const member of members) {
    const id = member._id.toString();
    if (visited.has(id)) continue;

    const queue = [id];
    const componentIds = [];
    visited.add(id);

    while (queue.length > 0) {
      const cur = queue.shift();
      componentIds.push(cur);
      for (const neighbor of adj.get(cur) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const component = componentIds.map((uid) => memberById.get(uid));
    clusters.push(orderClusterMembers(component, tasks, dateKeys));
  }

  return clusters;
}

export function orderScheduleClusters(departments, tasks, dateKeys, currentUserId) {
  const members = flattenDepartmentMembers(departments);
  const clusters = clusterMembersBySharedTasks(members, tasks, dateKeys);

  const uid = currentUserId?.toString() || null;

  clusters.sort((a, b) => {
    const aHas = uid && a.some((m) => m._id.toString() === uid);
    const bHas = uid && b.some((m) => m._id.toString() === uid);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (b.length !== a.length) return b.length - a.length;
    return (a[0]?.name || '').localeCompare(b[0]?.name || '');
  });

  return clusters.map((cluster) => {
    if (!uid) return cluster;
    const idx = cluster.findIndex((m) => m._id.toString() === uid);
    if (idx <= 0) return cluster;
    return [cluster[idx], ...cluster.slice(0, idx), ...cluster.slice(idx + 1)];
  });
}

export function buildClusterLayout(clusterMembers, tasks, dateKeys, memberById = null) {
  const memberIds = clusterMembers.map((m) => m._id.toString());
  const memberIdSet = new Set(memberIds);
  const resolvedMemberById = memberById || memberByIdFromMembers(clusterMembers);
  const tasksByMember = new Map(memberIds.map((id) => [id, []]));

  for (const task of tasks || []) {
    if (!getTaskPlacement(task, dateKeys)) continue;

    const assigneesInCluster = getTaskAssigneeIds(task).filter((id) => memberIdSet.has(id));
    if (assigneesInCluster.length === 0) continue;

    for (const memberId of assigneesInCluster) {
      tasksByMember.get(memberId).push({
        task,
        coAssignees: coAssigneesFromTask(task, memberId, resolvedMemberById),
      });
    }
  }

  const soloPlacements = new Map();
  for (const member of clusterMembers) {
    const uid = member._id.toString();
    const entries = tasksByMember.get(uid) || [];
    soloPlacements.set(uid, {
      lanes: assignEntryLanes(entries, dateKeys),
      tooltip: entries.map((e) => e.task.title).join(' · '),
      taskCount: entries.length,
    });
  }

  return { soloPlacements };
}

export function partitionDepartmentsForUser(departments, currentUserId) {
  if (!departments?.length) {
    return { ownMember: null, ownDepartment: null, otherDepartments: [] };
  }
  if (!currentUserId) {
    return { ownMember: null, ownDepartment: null, otherDepartments: departments };
  }

  const uid = currentUserId.toString();
  let ownMember = null;
  let ownDepartment = null;
  const otherDepartments = [];

  for (const group of departments) {
    const remaining = [];
    for (const member of group.users || []) {
      if (member._id?.toString() === uid) {
        ownMember = member;
        ownDepartment = group.department;
      } else {
        remaining.push(member);
      }
    }
    if (remaining.length > 0) {
      otherDepartments.push({ ...group, users: remaining });
    }
  }

  return { ownMember, ownDepartment, otherDepartments };
}
