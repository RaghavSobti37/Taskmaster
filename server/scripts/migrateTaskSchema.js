/**
 * Backfill task documents to match current Task schema and TaskService timeline logic.
 *
 * Usage:
 *   node server/scripts/migrateTaskSchema.js --dry-run
 *   node server/scripts/migrateTaskSchema.js --execute
 *
 * Fields backfilled (only when missing or invalid — existing valid data is preserved):
 *   status, priority, type, scheduleSlot, workspace
 *   scheduleDate, startDate, dueDate (timeline anchors + priority-based due date)
 *   plannedHours, actualHours, progress, notifiedWarning, notifiedOverdue, parentTaskId
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  computeDueDateFromStart,
  getPriorityDaySpan,
} = require('../../shared/taskPriorityDates');

const VALID_SLOTS = new Set(['AM', 'PM', 'FULL']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_STATUSES = new Set(['todo', 'in-progress', 'in-review', 'done']);

const STATUS_ALIASES = {
  completed: 'done',
  complete: 'done',
  done: 'done',
  pending: 'todo',
  open: 'todo',
  'in progress': 'in-progress',
  in_progress: 'in-progress',
  inprogress: 'in-progress',
  'in review': 'in-review',
  in_review: 'in-review',
  inreview: 'in-review',
  todo: 'todo',
};

const LEGACY_TYPE_MAP = {
  edit: 'content',
  'final cut': 'content',
  'final edit': 'content',
  grading: 'content',
  dubbing: 'content',
  color: 'content',
  mix: 'content',
  export: 'content',
  film: 'content',
  audio: 'content',
  compression: 'ops',
  rushes: 'ops',
  planning: 'ops',
  support: 'ops',
  review: 'review',
  bug: 'bug',
  fix: 'bug',
  feature: 'feature',
  design: 'design',
  general: 'general',
};

const VALID_TYPES = new Set(Object.values(LEGACY_TYPE_MAP));

function parseArgs() {
  const execute = process.argv.includes('--execute');
  const dryRun = process.argv.includes('--dry-run') || !execute;
  if (!execute && !process.argv.includes('--dry-run')) {
    console.log('No mode flag — defaulting to --dry-run (pass --execute to write)');
  }
  return { dryRun, execute };
}

function isValidDate(value) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(d.getTime());
}

function toStartOfDay(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeStatus(raw) {
  if (raw == null || raw === '') return 'todo';
  const key = String(raw).trim().toLowerCase();
  const mapped = STATUS_ALIASES[key] || key;
  return VALID_STATUSES.has(mapped) ? mapped : 'todo';
}

function normalizePriority(raw) {
  if (raw == null || raw === '') return 'medium';
  const key = String(raw).trim().toLowerCase();
  return VALID_PRIORITIES.has(key) ? key : 'medium';
}

function normalizeScheduleSlot(raw) {
  if (raw == null || raw === '') return 'FULL';
  const key = String(raw).trim().toUpperCase();
  return VALID_SLOTS.has(key) ? key : 'FULL';
}

function normalizeType(raw) {
  if (raw == null || raw === '') return 'general';
  const key = String(raw).trim().toLowerCase();
  if (VALID_TYPES.has(key)) return key;
  if (LEGACY_TYPE_MAP[key]) return LEGACY_TYPE_MAP[key];
  for (const [legacy, category] of Object.entries(LEGACY_TYPE_MAP)) {
    if (key.includes(legacy)) return category;
  }
  return 'general';
}

function resolveTimelineAnchor(task) {
  if (isValidDate(task.scheduleDate)) return toStartOfDay(task.scheduleDate);
  if (isValidDate(task.startDate)) return toStartOfDay(task.startDate);
  if (isValidDate(task.dueDate)) return toStartOfDay(task.dueDate);
  if (isValidDate(task.createdAt)) return toStartOfDay(task.createdAt);
  return toStartOfDay(new Date());
}

function computeDueDateDate(anchor, priority) {
  const ymd = computeDueDateFromStart(anchor, priority);
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function buildUpdates(task) {
  const updates = {};
  const reasons = [];

  const status = normalizeStatus(task.status);
  if (task.status !== status) {
    updates.status = status;
    reasons.push(`status:${task.status || '(empty)'}→${status}`);
  }

  const priority = normalizePriority(task.priority);
  if (task.priority !== priority) {
    updates.priority = priority;
    reasons.push(`priority:${task.priority || '(empty)'}→${priority}`);
  }

  const scheduleSlot = normalizeScheduleSlot(task.scheduleSlot);
  if (task.scheduleSlot !== scheduleSlot) {
    updates.scheduleSlot = scheduleSlot;
    reasons.push(`scheduleSlot:${task.scheduleSlot || '(empty)'}→${scheduleSlot}`);
  }

  const workspace = task.workspace ? String(task.workspace) : 'General';
  if (!task.workspace) {
    updates.workspace = workspace;
    reasons.push('workspace:(empty)→General');
  }

  const type = normalizeType(task.type);
  if (task.type !== type) {
    updates.type = type;
    reasons.push(`type:${task.type || '(empty)'}→${type}`);
  }

  const anchor = resolveTimelineAnchor(task);
  const effectivePriority = updates.priority || priority;

  if (!isValidDate(task.scheduleDate)) {
    updates.scheduleDate = anchor;
    reasons.push('scheduleDate:backfill');
  }

  if (!isValidDate(task.startDate)) {
    updates.startDate = updates.scheduleDate || anchor;
    reasons.push('startDate:backfill');
  }

  if (!isValidDate(task.dueDate)) {
    updates.dueDate = computeDueDateDate(updates.scheduleDate || anchor, effectivePriority);
    reasons.push('dueDate:computed-from-priority');
  }

  if (task.plannedHours == null || Number.isNaN(Number(task.plannedHours))) {
    updates.plannedHours = 0;
    reasons.push('plannedHours:default-0');
  }

  if (task.actualHours == null || Number.isNaN(Number(task.actualHours))) {
    updates.actualHours = 0;
    reasons.push('actualHours:default-0');
  }

  if (task.progress == null || Number.isNaN(Number(task.progress))) {
    updates.progress = task.status === 'done' || status === 'done' ? 100 : 0;
    reasons.push('progress:default');
  } else {
    const p = Math.min(100, Math.max(0, Number(task.progress)));
    if (p !== task.progress) {
      updates.progress = p;
      reasons.push(`progress:clamp→${p}`);
    }
  }

  if (task.notifiedWarning == null) {
    updates.notifiedWarning = false;
    reasons.push('notifiedWarning:default-false');
  }

  if (task.notifiedOverdue == null) {
    updates.notifiedOverdue = false;
    reasons.push('notifiedOverdue:default-false');
  }

  if (task.parentTaskId === undefined) {
    updates.parentTaskId = null;
    reasons.push('parentTaskId:default-null');
  }

  if (
    (updates.scheduleDate || isValidDate(task.scheduleDate))
    && (updates.dueDate || isValidDate(task.dueDate))
    && (task.duration == null || Number.isNaN(Number(task.duration)))
  ) {
    const start = updates.scheduleDate || toStartOfDay(task.scheduleDate);
    const due = updates.dueDate || toStartOfDay(task.dueDate);
    const span = getPriorityDaySpan(effectivePriority);
    const diffDays = Math.round((due - start) / (24 * 60 * 60 * 1000));
    updates.duration = diffDays > 0 ? diffDays : span;
    reasons.push('duration:computed');
  }

  if (status === 'done' && !task.completedAt && !isValidDate(task.completedAt)) {
    updates.completedAt = isValidDate(task.updatedAt) ? task.updatedAt : new Date();
    reasons.push('completedAt:backfill-for-done');
  }

  return { updates, reasons };
}

async function migrate() {
  const { dryRun, execute } = parseArgs();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in server/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected — mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);

  const db = mongoose.connection.db;
  const collection = db.collection('tasks');
  const cursor = collection.find({});

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const sampleChanges = [];

  while (await cursor.hasNext()) {
    const task = await cursor.next();
    scanned += 1;

    const { updates, reasons } = buildUpdates(task);
    if (!Object.keys(updates).length) {
      skipped += 1;
      continue;
    }

    updated += 1;
    if (sampleChanges.length < 15) {
      sampleChanges.push({
        id: task._id.toString(),
        title: task.title,
        reasons,
        fields: Object.keys(updates),
      });
    }

    if (execute) {
      await collection.updateOne({ _id: task._id }, { $set: updates });
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Scanned:  ${scanned}`);
  console.log(`Updated:  ${updated}${dryRun ? ' (would update)' : ''}`);
  console.log(`Skipped:  ${skipped} (already valid)`);

  if (sampleChanges.length) {
    console.log('\n--- Sample changes ---');
    for (const row of sampleChanges) {
      console.log(`  ${row.id} "${row.title}"`);
      console.log(`    fields: ${row.fields.join(', ')}`);
      console.log(`    reasons: ${row.reasons.join('; ')}`);
    }
    if (updated > sampleChanges.length) {
      console.log(`  ... and ${updated - sampleChanges.length} more`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
