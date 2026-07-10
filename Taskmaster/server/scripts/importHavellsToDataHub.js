require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';
const mongoose = require('mongoose');
const {
  importHavellsIntoDataHub,
} = require('../services/havellsDataHubService');
const { ensureHavellsClone } = require('../lib/havellsDataRoot');
const { runWithContext } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');
const PersonHubBuilder = require('../services/PersonHubBuilder');
const { clearFolderCache } = require('../domains/data-hub/folderCache');

const HAVELLS_INLET_KEYS = [
  'havells_registered',
  'havells_selected',
  'havells_attended_delhi',
  'havells_attended_indore',
  'havells_attended_dumka',
];
const HAVELLS_INLET_FILTER = { 'inlets.key': { $in: HAVELLS_INLET_KEYS } };

function readArg(name, fallback = '') {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.slice(name.length + 1);
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const execute = process.argv.includes('--execute');
  const explicitRoot = readArg('--root', '');
  const rootPath = ensureHavellsClone({
    root: explicitRoot,
    pull: process.argv.includes('--pull'),
  });
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
  console.log(`[importHavellsToDataHub] Connected (${useProd ? 'production' : 'local'})`);
  console.log(`[importHavellsToDataHub] Root: ${rootPath}`);
  console.log(`[importHavellsToDataHub] Mode: ${execute ? 'execute' : 'dry-run'}`);

  const tenantId = await resolveDefaultTenantId();
  const stats = await runWithContext({ tenantId }, async () => importHavellsIntoDataHub({
    rootPath,
    dryRun: !execute,
    onProgress: (line) => console.log(`[importHavellsToDataHub] ${line}`),
  }));
  console.log('[importHavellsToDataHub] Stats:', JSON.stringify(stats, null, 2));

  if (execute && stats.imported > 0) {
    console.log('[importHavellsToDataHub] Syncing Havells inlet keys → PersonHubView (cursor, low memory)…');
    const syncResult = await runWithContext({ tenantId }, () => PersonHubBuilder.syncInletKeysFromPersonIndex({
      filter: HAVELLS_INLET_FILTER,
      onProgress: (line) => console.log(`[importHavellsToDataHub] ${line}`),
    }));
    console.log('[importHavellsToDataHub] Hub sync:', JSON.stringify(syncResult, null, 2));
    clearFolderCache();
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[importHavellsToDataHub] Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
