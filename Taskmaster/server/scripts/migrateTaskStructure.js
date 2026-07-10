/**
 * Migrate legacy task documents to new TaskAssignment structure and normalize fields.
 * Usage: node server/scripts/migrateTaskStructure.js [--unset-legacy]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');

const VALID_SLOTS = new Set(['AM', 'PM', 'FULL']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_STATUSES = new Set(['todo', 'in-progress', 'in-review', 'done']);

const LEGACY_TYPE_MAP = {
  edit: 'content',
  'final cut': 'content',
  filming: 'content',
  review: 'review',
  bug: 'bug',
  feature: 'feature',
  sales: 'sales',
};

function normalizeType(raw) {
  if (!raw) return 'general';
  const key = String(raw).toLowerCase().trim();
  return LEGACY_TYPE_MAP[key] || key || 'general';
}

async function migrate() {
  const unsetLegacy = process.argv.includes('--unset-legacy');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const rawTasks = await db.collection('tasks').find({}).toArray();

  let assignmentCount = 0;
  let normalizedCount = 0;

  for (const task of rawTasks) {
    if (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
      for (const assignee of task.assignees) {
        const userId = assignee._id || assignee;
        await TaskAssignment.updateOne(
          { taskId: task._id, userId },
          { $set: { taskId: task._id, userId, assignedAt: task.createdAt || new Date() } },
          { upsert: true }
        );
        assignmentCount += 1;
      }
      if (unsetLegacy) {
        await db.collection('tasks').updateOne({ _id: task._id }, { $unset: { assignees: '' } });
      }
    }

    const updates = {};
    if (!task.scheduleSlot || !VALID_SLOTS.has(task.scheduleSlot)) {
      updates.scheduleSlot = 'FULL';
    }
    if (!task.workspace) {
      updates.workspace = 'General';
    }
    if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
      updates.priority = 'medium';
    }
    if (task.status && !VALID_STATUSES.has(task.status)) {
      updates.status = 'todo';
    }
    const normalizedType = normalizeType(task.type);
    if (task.type !== normalizedType) {
      updates.type = normalizedType;
    }

    if (Object.keys(updates).length) {
      await Task.updateOne({ _id: task._id }, { $set: updates });
      normalizedCount += 1;
    }
  }

  console.log(`Migrated ${assignmentCount} assignment rows`);
  console.log(`Normalized ${normalizedCount} task documents`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
