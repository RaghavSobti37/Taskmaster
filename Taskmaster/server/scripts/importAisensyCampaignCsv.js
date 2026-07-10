require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { importAisensyCampaignCsv } = require('../services/aisensyCampaignImportService');
const { runWithContext } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');

function readArg(name, fallback = '') {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  return match.slice(name.length + 1);
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const execute = process.argv.includes('--execute');
  const filePath = readArg('--file', '');
  const campaignName = readArg('--campaign', '');
  const status = readArg('--status', '');

  if (!filePath) {
    console.error('Usage: node scripts/importAisensyCampaignCsv.js --file=<path> [--prod] [--execute] [--campaign=...] [--status=failed]');
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

  const tenantId = await resolveDefaultTenantId();
  const stats = await runWithContext({ tenantId }, () => importAisensyCampaignCsv({
    filePath,
    campaignName: campaignName || undefined,
    defaultStatus: status || undefined,
    sourceFilename: filePath,
    dryRun: !execute,
  }));

  console.log('[importAisensyCampaignCsv]', JSON.stringify(stats, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[importAisensyCampaignCsv] Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
