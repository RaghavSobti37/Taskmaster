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

  // Fix duplicate empty phones in Leads
  console.log('🧹 Cleaning up duplicate empty phones in Leads...');
  const emptyPhoneLeads = await Lead.find({ phone: '' });
  for (let i = 0; i < emptyPhoneLeads.length; i++) {
    emptyPhoneLeads[i].phone = `EMPTY-${emptyPhoneLeads[i]._id}`;
    await emptyPhoneLeads[i].save();
  }

  console.log('🧹 Resolving other duplicate phones in Leads...');
  const duplicates = await Lead.aggregate([
    { $group: { _id: { tenantId: "$tenantId", phone: "$phone" }, count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  let dupCount = 0;
  for (const dup of duplicates) {
    // Keep the first document, modify the rest
    const docsToModify = dup.docs.slice(1);
    for (const docId of docsToModify) {
      await Lead.updateOne(
        { _id: docId },
        { $set: { phone: `${dup._id.phone}-DUP-${docId}` } }
      );
      dupCount++;
    }
  }
  console.log(`✅ Resolved ${dupCount} duplicate phones.`);

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
