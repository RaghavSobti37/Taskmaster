require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const PersonIndex = require('../models/PersonIndex');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const {
  loadCanonicalHavellsRecords,
  buildHavellsIdentitySet,
} = require('../services/havellsDataHubService');
const { buildDbMinusHavellsRows } = require('../services/dataHubDiffExportService');
const { ensureHavellsClone } = require('../lib/havellsDataRoot');

const DATA_HUB_BYPASS = bypassOptions('data_hub');

function readArg(name, fallback = '') {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.slice(name.length + 1);
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const explicitRoot = readArg('--root', '');
  const rootPath = ensureHavellsClone({ root: explicitRoot, pull: process.argv.includes('--pull') });
  const outPath = readArg('--out', '');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri.trim(), {
    serverSelectionTimeoutMS: 120000,
    connectTimeoutMS: 120000,
  });
  const { records } = await loadCanonicalHavellsRecords(rootPath);

  const people = await PersonIndex.find({})
    .setOptions(DATA_HUB_BYPASS)
    .select('name email phone imlPriority inArtistPath inArtistCrm inlets')
    .lean();

  const { rows, excludedArtistPr } = buildDbMinusHavellsRows(people, records);
  const parser = new Parser({ fields: ['name', 'email', 'phone'] });
  const csvString = parser.parse(rows);
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const defaultOut = path.join(__dirname, '../reports/datahub', `db_minus_havells_${datePart}.csv`);
  const target = outPath || defaultOut;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, csvString, 'utf8');

  console.log('[exportDbMinusHavellsCsv] complete');
  console.log(JSON.stringify({
    target,
    dbPeople: people.length,
    havellsIdentities: buildHavellsIdentitySet(records).size,
    excludedHolySheetArtistPr: excludedArtistPr,
    outputRows: rows.length,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[exportDbMinusHavellsCsv] Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
