/**
 * Seed all artist CRM CSVs from data/ folder.
 * Run: node server/scripts/seedArtistCrmFromData.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { importArtistCsvFile } = require('../services/artistCrmImportService');

const DATA_DIR = path.join(__dirname, '../../data');

const TARGET_FILES = [
  'YUGM __ TSC Artist Mastersheet - Media List.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - Pune Media List.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - Nashik Media List.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - events _ fests.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - Wavrkari sanstha and maharaj contact.csv',
  'TSC Artist Event Database - Master Database.csv',
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const admin = await User.findOne().setOptions({ bypassTenant: true }).sort({ createdAt: 1 });
  if (!admin) {
    throw new Error('No user found to attribute import');
  }

  let totalImported = 0;
  for (const filename of TARGET_FILES) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skip missing: ${filename}`);
      continue;
    }
    console.log(`Importing ${filename}...`);
    const result = await importArtistCsvFile({
      filePath,
      filename,
      userId: admin._id,
    });
    console.log(`  → ${result.imported} imported, ${result.skipped} skipped (${result.template})`);
    totalImported += result.imported;
  }

  console.log(`Done. Total imported: ${totalImported}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
