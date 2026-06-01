/**
 * Backfill / scheduled sync into Contact hub.
 * Usage:
 *   node server/scripts/reconcileDataHub.js        # incremental (new/changed only)
 *   node server/scripts/reconcileDataHub.js --full # full re-merge
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const DataHubService = require('../services/DataHubService');

async function main() {
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGO_URI not set');
    process.exit(1);
  }

  const full = process.argv.includes('--full');

  await mongoose.connect(uri.trim());
  console.log(`[reconcileDataHub] Connected to MongoDB (${useProd ? 'production' : 'local'})`);
  console.log(`[reconcileDataHub] Starting ${full ? 'full' : 'incremental'} sync…`);

  const started = Date.now();
  const stats = await DataHubService.syncAllInlets({
    full,
    incremental: !full,
    onProgress: (msg) => console.log(`[reconcileDataHub] ${msg}`),
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[reconcileDataHub] Done in ${elapsed}s:`, JSON.stringify(stats, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[reconcileDataHub] Failed:', err);
  process.exit(1);
});
