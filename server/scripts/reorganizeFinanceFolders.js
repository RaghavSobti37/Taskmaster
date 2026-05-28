/**
 * Sync finance document folderId placement from Downloads disk layout.
 * Root files on disk → folderId null. Subfolder files → matching folder record.
 *
 * Usage: node server/scripts/reorganizeFinanceFolders.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const { syncFolderPlacementFromDisk } = require('../utils/financeDiskSync');

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  const adminUser = (await User.findOne({ role: 'admin' })) || (await User.findOne({}));
  if (!adminUser) {
    console.error('No user found.');
    process.exit(1);
  }

  console.log('Syncing folder placement from disk...\n');
  const results = await syncFolderPlacementFromDisk(adminUser._id);

  for (const r of results) {
    console.log(JSON.stringify(r, null, 2));
    console.log('---');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
