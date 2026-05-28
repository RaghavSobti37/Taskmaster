/**
 * Delete finance folder records by name (empty or not).
 * Usage: node server/scripts/deleteFinanceFolders.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const FinanceDocument = require('../models/FinanceDocument');

const FOLDER_NAMES = ['April 2026', 'April 2026 - TSC Academy'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const folders = await FinanceDocument.find({
    isFolder: true,
    folderName: { $in: FOLDER_NAMES },
  }).populate('project', 'name');

  if (folders.length === 0) {
    console.log('No matching folders found.');
    await mongoose.disconnect();
    return;
  }

  for (const folder of folders) {
    const childCount = await FinanceDocument.countDocuments({
      folderId: folder._id,
      isFolder: { $ne: true },
    });
    console.log(
      `Deleting "${folder.folderName}" (${folder.project?.name || folder.project}) — ${childCount} document(s)`
    );
    if (childCount > 0) {
      await FinanceDocument.updateMany(
        { folderId: folder._id, isFolder: { $ne: true } },
        { $unset: { folderId: '' }, $set: { folderId: null } }
      );
      console.log('  → moved child docs to project root (folderId cleared)');
    }
    await FinanceDocument.deleteOne({ _id: folder._id });
    console.log('  → folder deleted');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
