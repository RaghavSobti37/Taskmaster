/**
 * Recover Artist Path responses from a local CSV backup into CoreKnot.
 *
 * Dry-run default:
 *   node server/scripts/recoverArtistPathCsv.js --csv "../../website/TSC-Website/data/Artist path questions - Sheet1.csv"
 *
 * Write local/prod when DB env exists:
 *   node server/scripts/recoverArtistPathCsv.js --execute --csv "<path>"
 *   node server/scripts/recoverArtistPathCsv.js --prod --execute --csv "<path>"
 */
const fs = require('fs');
const path = require('path');

for (const envPath of [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../../server/.env'),
]) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const mongoose = require('mongoose');
const { importRows, parseCsvRows } = require('../domains/artists/services/artistPathImportService');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');
const { ensurePersonHubIdentityIndexes } = require('./repairPersonHubIdentityIndexes');

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function identityStats(rows) {
  const emails = new Set();
  const phones = new Set();
  for (const row of rows) {
    const email = String(row.Email || row.email || '').trim().toLowerCase();
    const phone = String(row.Mobile || row.phone || row.Phone || '').replace(/\D/g, '');
    if (email) emails.add(email);
    if (phone) phones.add(phone);
  }
  return { rows: rows.length, uniqueEmails: emails.size, uniquePhones: phones.size };
}

async function main() {
  const csvArg = argValue('--csv', path.join(__dirname, '../../../../website/TSC-Website/data/Artist path questions - Sheet1.csv'));
  const csvPath = path.resolve(process.cwd(), csvArg);
  const execute = process.argv.includes('--execute');
  const useProd = process.argv.includes('--prod');

  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
  const rows = await parseCsvRows(fs.readFileSync(csvPath, 'utf8'));
  const stats = identityStats(rows);
  console.log('[recoverArtistPathCsv] source:', csvPath);
  console.log('[recoverArtistPathCsv] stats:', stats);

  if (!execute) {
    console.log('[recoverArtistPathCsv] dry-run only; add --execute to write CoreKnot.');
    return;
  }

  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  console.log(`[recoverArtistPathCsv] writing ${useProd ? 'prod' : 'local'} DB: ${mongoose.connection.db.databaseName}`);
  await ensurePersonHubIdentityIndexes();
  const result = await runWithDefaultWebhookTenant(() => importRows(rows, {
    filename: `artist_path_csv_recovery_${path.basename(csvPath)}`,
  }));
  console.log('[recoverArtistPathCsv] import:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
