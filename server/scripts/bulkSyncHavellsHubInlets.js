/**
 * Fast Havells inlet sync: merge PersonIndex inlet keys onto PersonHubView by email/phone.
 * Skips PersonIdentityService.resolvePerson when a hub row already exists.
 *
 * Run: node scripts/bulkSyncHavellsHubInlets.js [--prod] [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';
const mongoose = require('mongoose');
const PersonIndex = require('../models/PersonIndex');
const PersonHubView = require('../models/PersonHubView');
const PersonHubBuilder = require('../services/PersonHubBuilder');
const { clearFolderCache } = require('../domains/data-hub/folderCache');
const { runWithContext } = require('../utils/tenantContext');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');

const HAVELLS_INLET_KEYS = [
  'havells_registered',
  'havells_selected',
  'havells_attended_delhi',
  'havells_attended_indore',
  'havells_attended_dumka',
];
const FILTER = { 'inlets.key': { $in: HAVELLS_INLET_KEYS } };
const BATCH = 500;

function havellsKeysFromRow(row) {
  return [...new Set(
    (row.inlets || [])
      .map((inlet) => inlet.key)
      .filter((key) => HAVELLS_INLET_KEYS.includes(key)),
  )];
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const dryRun = process.argv.includes('--dry-run');
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
  let processed = 0;
  let bulkMatched = 0;
  let bulkModified = 0;
  let resolveNeeded = 0;
  let resolveDone = 0;
  const ops = [];

  const flush = async () => {
    if (!ops.length) return;
    if (dryRun) {
      bulkMatched += ops.length;
      ops.length = 0;
      return;
    }
    const result = await PersonHubView.collection.bulkWrite(ops, { ordered: false });
    bulkMatched += result.matchedCount || 0;
    bulkModified += result.modifiedCount || 0;
    ops.length = 0;
  };

  await runWithContext({ tenantId }, async () => {
    const cursor = PersonIndex.find(FILTER).lean().cursor();
    for await (const row of cursor) {
      processed += 1;
      const keys = havellsKeysFromRow(row);
      if (!keys.length) continue;

      const or = [];
      if (row.email) or.push({ email: row.email });
      if (row.phone) or.push({ phone: row.phone });

      if (or.length) {
        ops.push({
          updateMany: {
            filter: { $or: or },
            update: {
              $addToSet: { inletKeys: { $each: keys } },
              $set: { updatedAt: new Date() },
            },
          },
        });
      } else {
        resolveNeeded += 1;
        if (!dryRun) {
          const outcome = await PersonHubBuilder._syncPersonIndexRow(row);
          if (outcome.status !== 'skipped' && outcome.status !== 'unmatched') resolveDone += 1;
        }
      }

      if (ops.length >= BATCH) {
        await flush();
        console.log(`[bulkSyncHavells] processed ${processed}`);
      }
    }
    await flush();
    clearFolderCache();
  });

  console.log(JSON.stringify({
    processed,
    bulkMatched,
    bulkModified,
    resolveNeeded,
    resolveDone,
    dryRun,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[bulkSyncHavells] Failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
