require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { syncAisensyCampaignCatalog } = require('../services/aisensyCampaignCatalogSyncService');
const { importAisensyExportsFromDirectories } = require('../services/aisensyCampaignOutcomesSyncService');
const { runWithContext } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');
const { assertProdDataTarget } = require('../utils/assertProdDataTarget');

function readArg(name, fallback = '') {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.slice(name.length + 1);
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const execute = process.argv.includes('--execute');
  const exportDir = readArg('--dir', '');

  if (execute && !useProd) {
    console.error('[syncAisensyCampaignOutcomes] Refusing to write: pass --prod for production database only');
    process.exit(1);
  }

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

  if (execute) assertProdDataTarget();

  const tenantId = await resolveDefaultTenantId();
  const dirs = exportDir ? [exportDir] : [];
  const outcomeStats = await runWithContext({ tenantId }, () => importAisensyExportsFromDirectories({
    dirs,
    dryRun: !execute,
  }));

  let catalogStats = null;
  if (execute) {
    catalogStats = await runWithContext({ tenantId }, () => syncAisensyCampaignCatalog({ dryRun: false }));
  }

  console.log('[syncAisensyCampaignOutcomes]', JSON.stringify({ catalog: catalogStats, outcomes: outcomeStats }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[syncAisensyCampaignOutcomes] Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
