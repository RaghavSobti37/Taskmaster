/**
 * Normalize DAILY_LOG ownership — sync userId/actorId and fix task-linked logs.
 *
 * Usage (repo root):
 *   node server/scripts/repairDailyLogOwnership.js [--dry-run] [--prod]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { resolveMongoUri, assertSafeDbTarget } = require('../config/database');
const Log = require('../models/Log');
const Task = require('../models/Task');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const BYPASS = bypassOptions('DAILY_LOG_REPAIR');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const useProd = argv.includes('--prod');
if (useProd) process.env.MAIL_USE_PROD_DB = 'true';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

(async () => {
  const uri = resolveMongoUri();
  assertSafeDbTarget(uri, { allowProd: useProd });
  await mongoose.connect(uri);
  console.log(`Connected — ${dryRun ? 'DRY RUN' : 'APPLY'}`);

  const logs = await Log.find({ action: 'DAILY_LOG' }).setOptions(BYPASS).lean();
  let actorSync = 0;
  let userIdBackfill = 0;
  let taskOwnerFix = 0;

  for (const log of logs) {
    const updates = {};

    if (!log.userId && log.actorId && isObjectId(log.actorId)) {
      updates.userId = new mongoose.Types.ObjectId(String(log.actorId));
      userIdBackfill += 1;
    }

    const effectiveUserId = updates.userId || log.userId;
    if (effectiveUserId && String(log.actorId || '') !== String(effectiveUserId)) {
      updates.actorId = String(effectiveUserId);
      actorSync += 1;
    }

    const logType = log.details?.type;
    if (
      (logType === 'TASK_COMPLETION' || logType === 'TASK_REVIEW')
      && log.targetId
      && effectiveUserId
    ) {
      const task = await Task.findById(log.targetId).select('assignments createdBy').setOptions(BYPASS).lean();
      if (task) {
        let expectedUserId = null;
        if (logType === 'TASK_REVIEW') {
          expectedUserId = task.createdBy;
        } else {
          const delegated = (task.assignments || []).find((a) => a?.userId);
          expectedUserId = delegated?.userId || task.createdBy;
        }
        if (expectedUserId && String(expectedUserId) !== String(effectiveUserId)) {
          updates.userId = expectedUserId;
          updates.actorId = String(expectedUserId);
          taskOwnerFix += 1;
        }
      }
    }

    if (Object.keys(updates).length) {
      if (dryRun) {
        console.log(`[dry-run] ${log._id}`, updates);
      } else {
        await Log.updateOne({ _id: log._id }, { $set: updates }).setOptions(BYPASS);
      }
    }
  }

  console.log(JSON.stringify({
    scanned: logs.length,
    userIdBackfill,
    actorSync,
    taskOwnerFix,
    dryRun,
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
