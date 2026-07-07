/**
 * Rebuild PersonHubView from PersonIndex (syncs Havells + other inlet-only rows into hub).
 * Run: node scripts/rebuildPersonHub.js [--prod]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';
const mongoose = require('mongoose');
const PersonHubBuilder = require('../services/PersonHubBuilder');
const { clearFolderCache } = require('../domains/data-hub/folderCache');
const PersonHubView = require('../models/PersonHubView');
const { runWithContext } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');

const HAVELLS_INLET_KEYS = [
  'havells_registered',
  'havells_selected',
  'havells_attended_delhi',
  'havells_attended_indore',
  'havells_attended_dumka',
];

async function main() {
  const useProd = process.argv.includes('--prod');
  const syncOnly = process.argv.includes('--sync-only');
  const havellsOnly = process.argv.includes('--havells-only');
  const inletFilter = havellsOnly ? { 'inlets.key': { $in: HAVELLS_INLET_KEYS } } : null;
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

  const tenantId = await resolveDefaultTenantId();
  const result = await runWithContext({ tenantId }, async () => {
    console.log('[rebuildPersonHub] Clearing explicit null identity fields on hub rows…');
    const col = PersonHubView.collection;
    await col.updateMany({ email: null }, { $unset: { email: '' } });
    await col.updateMany({ phone: null }, { $unset: { phone: '' } });
    console.log('[rebuildPersonHub] Hub preflight complete');
    if (syncOnly) {
      const syncResult = await PersonHubBuilder.syncInletKeysFromPersonIndex({
        filter: inletFilter,
        onProgress: (line) => console.log(`[rebuildPersonHub] ${line}`),
      });
      clearFolderCache();
      return { mode: 'inlet_sync', havellsOnly, ...syncResult };
    }
    console.log('[rebuildPersonHub] Migrating PersonIndex → Person spine…');
    try {
      const idxResult = await PersonHubBuilder.rebuildFromPersonIndex({
        embedded: true,
        filter: inletFilter,
        onProgress: (line) => console.log(`[rebuildPersonHub] ${line}`),
      });
      console.log('[rebuildPersonHub] PersonIndex migrated:', idxResult);
      clearFolderCache();
      return { mode: 'full', ...idxResult };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      console.warn('[rebuildPersonHub] Full rebuild failed; running personId inlet sync…', error.message);
      const syncResult = await PersonHubBuilder.syncInletKeysFromPersonIndex({
        filter: inletFilter,
        onProgress: (line) => console.log(`[rebuildPersonHub] ${line}`),
      });
      clearFolderCache();
      return { mode: 'inlet_sync', fallbackReason: error.message, havellsOnly, ...syncResult };
    }
  });

  console.log('[rebuildPersonHub] Done:', JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[rebuildPersonHub] Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
