/**
 * One-time: remove creator rows from TaskAssignment; backfill mentionAccessIds.
 * Run: node server/scripts/migrateCreatorAssigneeSplit.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const { syncMentionAccessIds } = require('../utils/taskAccess');

async function run() {
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!uri) throw new Error('MONGODB_URI not set in server/.env');
  await mongoose.connect(uri);

  const tasks = await Task.find({}).select('_id createdBy title description projectId workspace').lean();
  let removed = 0;
  let synced = 0;

  for (const task of tasks) {
    const creatorId = task.createdBy?.toString();
    if (creatorId) {
      const result = await TaskAssignment.deleteMany({ taskId: task._id, userId: creatorId });
      removed += result.deletedCount || 0;
    }
    await syncMentionAccessIds(task);
    synced += 1;
  }

  console.log(`Done. Tasks processed: ${synced}, creator assignment rows removed: ${removed}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
