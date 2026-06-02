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

export function assignTaskLanes(tasks, dateKeys) {
  const placed = tasks
    .map((task) => {
      const placement = getTaskPlacement(task, dateKeys);
      if (!placement) return null;
      return { task, ...placement };
    })
    .filter(Boolean);

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
