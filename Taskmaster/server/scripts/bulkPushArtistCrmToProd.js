/**
 * Mass-push all artist CRM CSVs via MongoDB bulkWrite (fast — no row-by-row upserts).
 *
 * Local:  node server/scripts/bulkPushArtistCrmToProd.js
 * Prod:   node server/scripts/bulkPushArtistCrmToProd.js --prod
 *
 * Optional: --fix-index  fixes email index before import (recommended on prod once)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { bulkImportArtistCsvFiles } = require('../services/artistCrmImportService');

const DATA_DIR = path.join(__dirname, '../../data');

const TARGET_FILES = [
  'YUGM __ TSC Artist Mastersheet - Media List.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - Pune Media List.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - Nashik Media List.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - events _ fests.csv',
  'harshaDuhita Collective __ TSC Talent Mastersheet - Wavrkari sanstha and maharaj contact.csv',
  'TSC Artist Event Database - Master Database.csv',
];

async function fixEmailIndex(uri) {
  await mongoose.connect(uri);
  const unset = await Lead.updateMany(
    { $or: [{ email: '' }, { email: null }] },
    { $unset: { email: 1 } },
    { bypassTenant: true }
  );
  console.log(`Unset empty/null email on ${unset.modifiedCount} leads`);
  const col = Lead.collection;
  const indexes = await col.indexes();
  if (indexes.find((idx) => idx.name === 'tenantId_1_email_1')) {
    await col.dropIndex('tenantId_1_email_1');
    console.log('Dropped legacy tenantId_1_email_1 index');
  }
  await Lead.syncIndexes();
  console.log('Synced Lead indexes');
  await mongoose.disconnect();
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);

  if (!uri) {
    throw new Error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
  }

  console.log(`[bulkPush] Target: ${useProd ? 'PRODUCTION' : 'local'}`);

  if (process.argv.includes('--fix-index')) {
    await fixEmailIndex(uri);
  }

  await mongoose.connect(uri);
  const started = Date.now();

  const admin = await User.findOne().setOptions({ bypassTenant: true }).sort({ createdAt: 1 });
  if (!admin) throw new Error('No user found to attribute import');

  const files = TARGET_FILES
    .map((filename) => ({ filename, filePath: path.join(DATA_DIR, filename) }))
    .filter(({ filePath, filename }) => {
      if (!fs.existsSync(filePath)) {
        console.warn(`Skip missing: ${filename}`);
        return false;
      }
      return true;
    });

  console.log(`[bulkPush] Parsing ${files.length} CSVs → bulkWrite…`);
  const result = await bulkImportArtistCsvFiles({
    files,
    userId: admin._id,
    skipContacts: true,
  });

  for (const f of result.files) {
    console.log(`  ${f.filename}: ${f.imported} prepared, ${f.skipped} skipped (${f.template})`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
  console.log(`  Prepared: ${result.prepared}`);
  console.log(`  Upserted: ${result.upserted}`);
  console.log(`  Modified: ${result.modified}`);
  console.log(`  Skipped rows: ${result.skipped}`);
  if (result.failed) console.log(`  Bulk write failures: ${result.failed}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
