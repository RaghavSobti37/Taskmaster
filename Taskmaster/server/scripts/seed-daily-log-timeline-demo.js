#!/usr/bin/env node
/**
 * Seed DAILY_LOG rows with start/end times for DailyLogTimeline preview (local dev).
 *
 * Usage (from coreknot/Taskmaster/server):
 *   node scripts/seed-daily-log-timeline-demo.js --email user@example.com
 *   node scripts/seed-daily-log-timeline-demo.js --userId 507f1f77bcf86cd799439011
 *   npm run seed:daily-log-demo
 *
 * Targets SEED_USER_EMAIL, else first admin user. Idempotent via details.seedTag.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { resolveMongoUri, assertSafeDbTarget, isProdLikeDbName, getDbNameFromUri } = require('../config/database');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const Log = require('../models/Log');
const User = require('../models/User');
const Department = require('../models/Department');
const {
  computeTimeSpentFromInterval,
  normalizeDailyLogDetails,
} = require('../../shared/dailyLogDetails');
const { getTodayDateKey, toDateKey } = require('../../shared/dateValidation');

const SEED_TAG = 'timeline-demo';
const BYPASS = bypassOptions('DAILY_LOG_TIMELINE_DEMO');

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function shiftDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

function istCreatedAt(workDate, clock) {
  return new Date(`${workDate}T${clock}:00+05:30`);
}

function buildLogDoc(userId, workDate, block) {
  const details = normalizeDailyLogDetails({
    workDate,
    title: block.title,
    message: block.message || '',
    startTime: block.start,
    endTime: block.end,
    timeSpent: computeTimeSpentFromInterval(block.start, block.end),
    seedTag: SEED_TAG,
  });

  const createdAt = istCreatedAt(workDate, block.start);

  return {
    userId,
    actorId: String(userId),
    origin: 'HUMAN_USER',
    action: 'DAILY_LOG',
    actionType: 'DAILY_LOG',
    status: 'SUCCESS',
    details,
    createdAt,
    timestamp: createdAt,
  };
}

const TODAY_BLOCKS = [
  { start: '08:30', end: '09:00', title: 'Email triage', message: 'Inbox + Slack catch-up' },
  { start: '09:00', end: '10:30', title: 'Morning standup + planning', message: 'Team sync and sprint board' },
  { start: '10:45', end: '12:30', title: 'Feature work', message: 'Daily log timeline UI' },
  { start: '13:00', end: '13:45', title: 'Lunch + notes', message: 'Quick break' },
  { start: '14:00', end: '16:00', title: 'Client calls', message: 'Two stakeholder check-ins' },
  { start: '16:15', end: '18:00', title: 'Code review', message: 'PR feedback and merges' },
  { start: '18:15', end: '19:00', title: 'Documentation', message: 'Update runbooks' },
];

const YESTERDAY_BLOCKS = [
  { start: '10:00', end: '12:00', title: 'Sprint planning', message: 'Backlog grooming' },
  { start: '14:30', end: '17:00', title: 'Deep work session', message: 'Attendance metrics refactor' },
];

async function resolveTargetUser() {
  const userIdArg = getArg('--userId');
  if (userIdArg) {
    if (!mongoose.Types.ObjectId.isValid(userIdArg)) {
      throw new Error(`Invalid --userId: ${userIdArg}`);
    }
    const user = await User.findById(userIdArg).select('_id email name').setOptions(BYPASS).lean();
    if (!user) throw new Error(`No user for --userId ${userIdArg}`);
    return user;
  }

  const emailArg = getArg('--email') || process.env.SEED_USER_EMAIL;
  if (emailArg) {
    const user = await User.findOne({ email: String(emailArg).trim().toLowerCase() })
      .select('_id email name')
      .setOptions(BYPASS)
      .lean();
    if (!user) throw new Error(`No user for email ${emailArg}`);
    return user;
  }

  const adminDept = await Department.findOne({ slug: 'admin' }).select('_id').setOptions(BYPASS).lean();
  if (!adminDept) throw new Error('No admin department — pass --email or --userId');

  const adminUser = await User.findOne({ departmentId: adminDept._id })
    .select('_id email name')
    .setOptions(BYPASS)
    .lean();
  if (!adminUser) throw new Error('No admin user — pass --email or --userId');

  return adminUser;
}

async function main() {
  if (process.argv.includes('--prod')) {
    console.error('Refusing --prod. This script is for local dev only.');
    process.exit(1);
  }

  const { dbUri, source } = resolveMongoUri();
  const dbName = getDbNameFromUri(dbUri);
  if (isProdLikeDbName(dbName) && process.env.ALLOW_PROD_DB_IN_DEV !== 'true') {
    console.error(
      `Refusing production-like database "${dbName}". Use local MONGODB_URI or set ALLOW_PROD_DB_IN_DEV=true intentionally.`,
    );
    process.exit(1);
  }

  assertSafeDbTarget(dbUri, { source });
  await mongoose.connect(dbUri);
  console.log(`Connected (${source}, db: ${dbName || 'unknown'})`);

  const user = await resolveTargetUser();
  const userId = user._id;
  console.log(`Target user: ${user.name} <${user.email}> (${userId})`);

  const today = getTodayDateKey();
  const yesterday = shiftDateKey(today, -1);

  const removed = await Log.deleteMany({
    userId,
    action: 'DAILY_LOG',
    'details.seedTag': SEED_TAG,
  }).setOptions(BYPASS);
  if (removed.deletedCount) {
    console.log(`Removed ${removed.deletedCount} prior demo log(s)`);
  }

  const docs = [
    ...TODAY_BLOCKS.map((b) => buildLogDoc(userId, today, b)),
    ...YESTERDAY_BLOCKS.map((b) => buildLogDoc(userId, yesterday, b)),
  ];

  const inserted = await Log.insertMany(docs, { ordered: true });
  console.log(JSON.stringify({
    ok: true,
    userId: String(userId),
    email: user.email,
    today,
    yesterday,
    inserted: inserted.length,
    todayBlocks: TODAY_BLOCKS.length,
    yesterdayBlocks: YESTERDAY_BLOCKS.length,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
