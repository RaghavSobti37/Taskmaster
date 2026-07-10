require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { syncAisensyCampaignCatalog } = require('../services/aisensyCampaignCatalogSyncService');
const { runWithContext } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');
const { assertProdDataTarget } = require('../utils/assertProdDataTarget');
const { getDbNameFromUri } = require('../config/database');

async function main() {
  const useProd = process.argv.includes('--prod');
  const execute = process.argv.includes('--execute');

  if (execute && !useProd) {
    console.error('[syncAisensyCampaignCatalog] Refusing to write: pass --prod for production database only');
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

  if (execute) {
    assertProdDataTarget();
    console.log('[syncAisensyCampaignCatalog] target DB:', mongoose.connection.name);
  } else {
    console.log('[syncAisensyCampaignCatalog] dry-run against', getDbNameFromUri(uri) || mongoose.connection.name);
  }

  const tenantId = await resolveDefaultTenantId();
  const stats = await runWithContext({ tenantId }, () => syncAisensyCampaignCatalog({
    dryRun: !execute,
  }));

  console.log('[syncAisensyCampaignCatalog]', JSON.stringify(stats, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[syncAisensyCampaignCatalog] Failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
