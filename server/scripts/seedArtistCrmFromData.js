/**
 * Seed all artist CRM CSVs from data/ folder.
 *
 * Default (fast): bulkWrite mass import
 * Legacy (slow):  node server/scripts/seedArtistCrmFromData.js --slow
 * Production:     node server/scripts/seedArtistCrmFromData.js --prod
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { importArtistCsvFile, bulkImportArtistCsvFiles } = require('../services/artistCrmImportService');

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
  const useProd = process.argv.includes('--prod');
  const useSlow = process.argv.includes('--slow');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);

  if (!uri) {
    throw new Error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
  }

  await mongoose.connect(uri);

  const admin = await User.findOne().setOptions({ bypassTenant: true }).sort({ createdAt: 1 });
  if (!admin) {
    throw new Error('No user found to attribute import');
  }

  const files = TARGET_FILES
    .map((filename) => ({ filename, filePath: path.join(DATA_DIR, filename) }))
    .filter(({ filePath, filename }) => {
      if (!fs.existsSync(filePath)) {
        console.warn(`Skip missing: ${filename}`);
        return false;
      }
      return true;
    });

  if (!useSlow) {
    const started = Date.now();
    const result = await bulkImportArtistCsvFiles({ files, userId: admin._id, skipContacts: true });
    for (const f of result.files) {
      console.log(`  → ${f.imported} prepared, ${f.skipped} skipped (${f.template})`);
    }
    console.log(`Bulk done in ${((Date.now() - started) / 1000).toFixed(1)}s — upserted ${result.upserted}, modified ${result.modified}`);
    await mongoose.disconnect();
    return;
  }

  let totalImported = 0;
  for (const { filePath, filename } of files) {
    console.log(`Importing ${filename}…`);
    const result = await importArtistCsvFile({ filePath, filename, userId: admin._id });
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
