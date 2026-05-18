require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const TscData = require('../models/TscData');
const Lead = require('../models/Lead');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster';

async function purgeData() {
  try {
    console.log('[START] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[SUCCESS] Connected to MongoDB.');

    const query = {
      $or: [
        { name: { $exists: false } },
        { name: null },
        { name: '' },
        { name: { $regex: '^unknown$', $options: 'i' } },
        { email: { $exists: false } },
        { email: null },
        { email: '' }
      ]
    };

    console.log('[INFO] Scanning TscData (All Data) collection...');
    const tscRes = await TscData.deleteMany(query);
    console.log(`[PURGE] Removed ${tscRes.deletedCount} invalid records from TscData.`);

    console.log('[INFO] Scanning Lead (CRM) collection...');
    const leadRes = await Lead.deleteMany(query);
    console.log(`[PURGE] Removed ${leadRes.deletedCount} invalid records from Lead.`);

    console.log('\n========================================');
    console.log('[SUCCESS] Purge Execution Complete!');
    console.log(`- TscData Records Purged: ${tscRes.deletedCount}`);
    console.log(`- Lead Records Purged: ${leadRes.deletedCount}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Purge failed:', error);
    process.exit(1);
  }
}

purgeData();
