require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI_PROD;

async function pushToDb() {
  if (!uri) {
    console.error('❌ MONGODB_URI_PROD not found in .env');
    process.exit(1);
  }

  console.log('🔗 Connecting to Production DB...');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log('✅ Connected to Production DB.');

  // Load models
  console.log('📦 Loading models...');
  const User = require('../models/User');
  const Log = require('../models/Log');
  const Lead = require('../models/Lead');
  const Task = require('../models/Task');
  const Project = require('../models/Project');

  // Remove duplicate empty phones — keep oldest per tenant, delete the rest
  console.log('🧹 Cleaning up duplicate empty phones in Leads...');
  const emptyDupes = await Lead.aggregate([
    { $match: { phone: '' } },
    { $group: { _id: '$tenantId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  let emptyRemoved = 0;
  for (const group of emptyDupes) {
    for (const docId of group.docs.slice(1)) {
      await Lead.deleteOne({ _id: docId });
      emptyRemoved += 1;
    }
  }
  console.log(`✅ Removed ${emptyRemoved} redundant empty-phone leads.`);

  console.log('🧹 Resolving duplicate phones in Leads (delete extras, keep oldest)...');
  const duplicates = await Lead.aggregate([
    { $match: { phone: { $ne: '' } } },
    { $group: { _id: { tenantId: '$tenantId', phone: '$phone' }, count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  let dupCount = 0;
  for (const dup of duplicates) {
    const sorted = await Lead.find({
      tenantId: dup._id.tenantId,
      phone: dup._id.phone,
    }).sort({ createdAt: 1 }).select('_id').lean();
    for (const doc of sorted.slice(1)) {
      await Lead.deleteOne({ _id: doc._id });
      dupCount += 1;
    }
  }
  console.log(`✅ Removed ${dupCount} duplicate phone leads.`);

  console.log('🔧 Repairing legacy -DUP- / EMPTY- corrupt phones...');
  const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');
  const repairStats = await repairCorruptLeadPhones();
  console.log(`✅ Phone repair: ${repairStats.repaired} repaired, ${repairStats.deleted} deleted, ${repairStats.skipped} skipped.`);

  // Sync Indexes
  console.log('🔄 Syncing Indexes (Pushing Schema rules)...');
  await User.syncIndexes();
  await Log.syncIndexes();
  await Lead.syncIndexes();
  await Task.syncIndexes();
  await Project.syncIndexes();

  console.log('✅ Production DB Sync Complete. All schema indexes applied.');
  process.exit(0);
}

pushToDb().catch(err => {
  console.error('❌ DB Sync Error:', err.message);
  process.exit(1);
});
