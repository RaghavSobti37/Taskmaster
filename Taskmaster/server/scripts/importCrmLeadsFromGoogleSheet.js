/**
 * Import all tabs from a Google Sheet into CoreKnot artist CRM.
 * Skips existing leads (phone/email/importRowKey). Never updates existing rows.
 * Assigns all new leads to Akash.
 *
 * Share sheet with: tsc-newsletter@tsc-website-470512.iam.gserviceaccount.com (Viewer)
 *
 * Usage:
 *   node server/scripts/importCrmLeadsFromGoogleSheet.js --prod
 *   node server/scripts/importCrmLeadsFromGoogleSheet.js --prod --dry-run
 *   node server/scripts/importCrmLeadsFromGoogleSheet.js --prod --export-only
 *   node server/scripts/importCrmLeadsFromGoogleSheet.js --prod --import-only
 *   node server/scripts/importCrmLeadsFromGoogleSheet.js --allow-local
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const {
  importCrmLeadsFromGoogleSheet,
  importCrmLeadsFromLocalCsvDir,
  exportSheetTabsToCsvDir,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_CSV_DIR,
  SERVICE_ACCOUNT_EMAIL,
} = require('../services/crmGoogleSheetImportService');

async function main() {
  const allowLocal = process.argv.includes('--allow-local');
  const useProd = process.argv.includes('--prod') || !allowLocal;
  const dryRun = process.argv.includes('--dry-run');
  const exportOnly = process.argv.includes('--export-only');
  const importOnly = process.argv.includes('--import-only');
  const spreadsheetArg = process.argv.find((a) => a.startsWith('--sheet='));
  const spreadsheetId = spreadsheetArg ? spreadsheetArg.split('=')[1] : DEFAULT_SPREADSHEET_ID;
  const csvDir = path.join(DEFAULT_CSV_DIR, spreadsheetId);

  if (!useProd && !allowLocal) {
    throw new Error('Production-only by default. Pass --prod or --allow-local.');
  }

  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);
  if (!uri) {
    throw new Error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
  }

  console.log(useProd ? '[PROD]' : '[LOCAL]', dryRun ? '[DRY RUN]' : '', `Sheet: ${spreadsheetId}`);
  console.log(`CSV dir: ${csvDir}`);
  if (!importOnly) console.log(`Service account: ${SERVICE_ACCOUNT_EMAIL}`);

  await mongoose.connect(uri);
  const admin = await User.findOne().setOptions({ bypassTenant: true }).sort({ createdAt: 1 });
  if (!admin) throw new Error('No user found to attribute import');

  let result;
  if (importOnly) {
    result = await importCrmLeadsFromLocalCsvDir({
      csvDir,
      spreadsheetId,
      userId: admin._id,
      dryRun,
    });
  } else if (exportOnly) {
    const exported = await exportSheetTabsToCsvDir({ spreadsheetId, outputDir: csvDir });
    const manifest = {
      spreadsheetId,
      exportedAt: new Date().toISOString(),
      sheets: exported.files,
    };
    fs.writeFileSync(path.join(csvDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    result = exported;
  } else {
    result = await importCrmLeadsFromGoogleSheet({
      spreadsheetId,
      userId: admin._id,
      dryRun,
      csvDir,
    });
  }

  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
