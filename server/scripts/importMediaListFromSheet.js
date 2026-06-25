/**
 * Import all TSC media spreadsheet tabs into MongoDB (production by default).
 *
 * Usage:
 *   node server/scripts/importMediaListFromSheet.js --prod --replace
 *   node server/scripts/importMediaListFromSheet.js --prod --dry-run
 *   node server/scripts/importMediaListFromSheet.js --allow-local --replace
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { importAllMediaSheets } = require('../services/mediaListImportService');

async function main() {
  const allowLocal = process.argv.includes('--allow-local');
  const useProd = process.argv.includes('--prod') || !allowLocal;
  const dryRun = process.argv.includes('--dry-run');
  const replace = process.argv.includes('--replace');

  if (!useProd && !allowLocal) {
    throw new Error('Production-only import. Pass --prod (default) or --allow-local for dev DB.');
  }

  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);
  if (!uri) {
    throw new Error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
  }

  console.log(useProd ? '[PROD]' : '[LOCAL]', dryRun ? '[DRY RUN]' : '', replace ? '[REPLACE]' : '');

  await mongoose.connect(uri);
  const result = await importAllMediaSheets({ dryRun, replace });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
