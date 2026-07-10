const mongoose = require('mongoose');
const { getDateKey, startOfDayFromKey } = require('./attendanceDate');

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Normalize a Mongo filter into an $and clause list.
 * Preserves top-level keys (status, priority, …) alongside existing $and entries.
 */
function flattenFilterToAndClauses(filter = {}) {
  if (!filter || typeof filter !== 'object') return [{}];
  const { $and, ...rest } = filter;
  const clauses = [];
  if (Array.isArray($and) && $and.length) clauses.push(...$and);
  if (Object.keys(rest).length > 0) clauses.push(rest);
  return clauses.length ? clauses : [{}];
}

/**
 * Apply Todo page filters to an existing task query (scope=todo).
 */
function applyTodoFilters(filter = {}, query = {}, { skipStatFilter = false } = {}) {
  const next = { ...filter };

  if (query.search?.trim()) {
    const regex = new RegExp(escapeRegExp(query.search.trim()), 'i');
    next.$and = [...(next.$and || []), { $or: [{ title: regex }, { description: regex }] }];
  }

  if (query.status && query.status !== 'all') {
    next.status = query.status;
  }

  if (query.priority && query.priority !== 'all') {
    next.priority = query.priority;
  }

  if (query.type && query.type !== 'all') {
    next.type = query.type;
  }

  if (query.projectId && query.projectId !== 'all' && mongoose.Types.ObjectId.isValid(query.projectId)) {
    next.projectId = new mongoose.Types.ObjectId(query.projectId);
  }

  if (query.workspace && query.workspace !== 'all') {
    next.workspace = query.workspace;
  }

  const todayStart = startOfDayFromKey(getDateKey());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (!skipStatFilter && query.statFilter === 'open') {
    next.status = { $ne: 'done' };
  } else if (!skipStatFilter && query.statFilter === 'in-review') {
    next.status = 'in-review';
  } else if (!skipStatFilter && query.statFilter === 'overdue') {
    next.status = { $ne: 'done' };
    next.$and = [...(next.$and || []), {
      $expr: {
        $and: [
          { $ne: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, null] },
          { $lt: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, todayStart] },
        ],
      },
    }];
  } else if (!skipStatFilter && query.statFilter === 'today') {
    next.status = { $ne: 'done' };
    next.$and = [...(next.$and || []), {
      $expr: {
        $and: [
          { $gte: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, todayStart] },
          { $lt: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, tomorrow] },
        ],
      },
    }];
  }

  return next;
}

function getTodoSort(sortField, sortOrder) {
  const order = sortOrder === 'desc' ? -1 : 1;
  const allowed = {
    title: 'title',
    type: 'type',
    status: 'status',
    priority: 'priority',
    dueDate: 'dueDate',
    createdAt: 'createdAt',
  };
  const field = allowed[sortField] || 'dueDate';
  return { [field]: order, _id: 1 };
}

module.exports = { applyTodoFilters, getTodoSort, flattenFilterToAndClauses };
