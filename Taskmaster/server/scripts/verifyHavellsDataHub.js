#!/usr/bin/env node
/**
 * Compare Havells rows in PersonIndex vs PersonHubView inlet keys.
 * Usage: node scripts/verifyHavellsDataHub.js [--prod]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PersonIndex = require('../models/PersonIndex');
const PersonHubView = require('../models/PersonHubView');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const BYPASS = bypassOptions('data_hub');
const HAVELLS_KEYS = [
  'havells_registered',
  'havells_selected',
  'havells_attended_delhi',
  'havells_attended_indore',
  'havells_attended_dumka',
];
const INDEX_FILTER = { 'inlets.key': { $in: HAVELLS_KEYS } };

async function main() {
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri.trim(), { serverSelectionTimeoutMS: 120000 });
  const indexCount = await PersonIndex.countDocuments(INDEX_FILTER).setOptions(BYPASS);
  const hubByInletKeys = await PersonHubView.countDocuments({
    inletKeys: { $in: HAVELLS_KEYS },
  }).setOptions(BYPASS);
  const hubByFlags = await PersonHubView.countDocuments({ inOutsourced: true }).setOptions(BYPASS);

  const sample = await PersonIndex.find(INDEX_FILTER)
    .setOptions(BYPASS)
    .limit(3)
    .select('name email phone inlets')
    .lean();

  console.log(JSON.stringify({
    env: useProd ? 'production' : 'local',
    personIndexHavellsRows: indexCount,
    personHubViewWithHavellsInletKeys: hubByInletKeys,
    personHubViewOutsourcedFlag: hubByFlags,
    gap: Math.max(0, indexCount - hubByInletKeys),
    sample,
    fix: indexCount > hubByInletKeys
      ? 'Run: node scripts/rebuildPersonHub.js --prod --sync-only'
      : 'OK — run Data Hub → Rebuild hub if UI counts still stale',
  }, null, 2));

  await mongoose.disconnect();
  process.exit(indexCount > 0 && hubByInletKeys < indexCount * 0.9 ? 2 : 0);
}

main().catch(async (error) => {
  console.error('[verifyHavellsDataHub] Failed:', error.message);
  try { await mongoose.disconnect(); } catch { /* no-op */ }
  process.exit(1);
});
