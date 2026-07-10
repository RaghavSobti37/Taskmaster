/**
 * PersonHubView vs PersonIndex parity check (T3-2 step 1 — read-only diagnostic).
 *
 * WHAT "Data Hub counts match PersonIndex" MEANS:
 * During the person-spine migration, ContactService still dual-writes legacy PersonIndex
 * rows while PersonHubBuilder maintains PersonHubView (the new Data Hub read model).
 * The Data Hub UI picks PersonHubView when the hub is "active" (see folderCache.js).
 * Parity means that, for each tenant, PersonHubView document totals — and optionally
 * per-folder counts using the same folder queries as the UI — align with PersonIndex
 * within tolerance. Matching counts confirm the backfill caught up so PersonIndex can
 * become read-only and dual-write can stop without stale or missing people in Data Hub.
 *
 * Usage:
 *   node server/scripts/checkPersonHubParity.js              # local (MONGO_URI / MONGODB_URI)
 *   node server/scripts/checkPersonHubParity.js --prod         # production (MONGODB_URI_PROD)
 *   node server/scripts/checkPersonHubParity.js --verbose      # include per-folder breakdown
 *   node server/scripts/checkPersonHubParity.js --prod --verbose
 *
 * Exit code 0 = all tenants within tolerance; 1 = drift detected.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const PersonIndex = require('../models/PersonIndex');
const PersonHubView = require('../models/PersonHubView');
const { INLET_KEYS } = require('../../shared/dataInlets');
const { buildFolderQuery } = require('../domains/data-hub/queryHelpers');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const CONTACT_BYPASS = bypassOptions('data_hub');
const FOLDER_KEYS = ['all', ...INLET_KEYS, 'loyal'];
/** Same ratio folderCache uses when deciding hub is active enough vs legacy index. */
const TOTAL_PARITY_RATIO = 0.9;
const FOLDER_PARITY_RATIO = 0.9;

function parseArgs() {
  return {
    useProd: process.argv.includes('--prod'),
    verbose: process.argv.includes('--verbose'),
  };
}

function resolveUri(useProd) {
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGO_URI / MONGODB_URI not set');
    process.exit(1);
  }
  return uri.trim();
}

function tenantKey(id) {
  return id ? id.toString() : '(no tenantId)';
}

async function countByTenant(Model) {
  const rows = await Model.aggregate([
    { $group: { _id: '$tenantId', count: { $sum: 1 } } },
  ]).option(CONTACT_BYPASS);
  const map = new Map();
  for (const row of rows) {
    map.set(tenantKey(row._id), row.count);
  }
  return map;
}

async function countFolderForTenant(Model, tenantId, folder) {
  const query = buildFolderQuery(folder);
  if (tenantId && tenantId !== '(no tenantId)') {
    query.tenantId = new mongoose.Types.ObjectId(tenantId);
  } else {
    query.$or = [{ tenantId: null }, { tenantId: { $exists: false } }];
  }
  return Model.countDocuments(query).setOptions(CONTACT_BYPASS);
}

function withinTolerance(hubCount, indexCount, ratio = TOTAL_PARITY_RATIO) {
  if (indexCount === 0) return hubCount === 0;
  if (hubCount === 0) return indexCount === 0;
  return hubCount >= indexCount * ratio && hubCount <= indexCount * (1 / ratio + 0.05);
}

function formatDelta(hub, index) {
  const delta = hub - index;
  const pct = index > 0 ? `${((hub / index) * 100).toFixed(1)}%` : (hub > 0 ? '∞' : '100%');
  return { delta, pct };
}

async function main() {
  const { useProd, verbose } = parseArgs();
  const uri = resolveUri(useProd);

  await mongoose.connect(uri);
  console.log(`[checkPersonHubParity] Connected (${useProd ? 'production' : 'local'})\n`);

  const tenants = await Tenant.find({}).select('_id name').lean();
  const tenantNames = new Map(tenants.map((t) => [t._id.toString(), t.name]));

  const [hubByTenant, indexByTenant] = await Promise.all([
    countByTenant(PersonHubView),
    countByTenant(PersonIndex),
  ]);

  const allTenantIds = new Set([...hubByTenant.keys(), ...indexByTenant.keys()]);
  let driftFound = false;

  console.log('Tenant totals (PersonHubView vs PersonIndex)');
  console.log(
    'Tenant'.padEnd(28),
    'Hub'.padStart(8),
    'Index'.padStart(8),
    'Delta'.padStart(8),
    'Hub/Index'.padStart(10),
    'OK'.padStart(6)
  );
  console.log('-'.repeat(72));

  for (const tid of [...allTenantIds].sort()) {
    const hub = hubByTenant.get(tid) || 0;
    const index = indexByTenant.get(tid) || 0;
    const ok = withinTolerance(hub, index);
    if (!ok) driftFound = true;
    const { delta, pct } = formatDelta(hub, index);
    const label = tenantNames.get(tid) || tid;
    console.log(
      label.slice(0, 28).padEnd(28),
      String(hub).padStart(8),
      String(index).padStart(8),
      (delta >= 0 ? `+${delta}` : String(delta)).padStart(8),
      pct.padStart(10),
      (ok ? 'yes' : 'NO').padStart(6)
    );
  }

  const globalHub = [...hubByTenant.values()].reduce((a, b) => a + b, 0);
  const globalIndex = [...indexByTenant.values()].reduce((a, b) => a + b, 0);
  const globalOk = withinTolerance(globalHub, globalIndex);
  if (!globalOk) driftFound = true;

  console.log('-'.repeat(72));
  console.log(
    'GLOBAL'.padEnd(28),
    String(globalHub).padStart(8),
    String(globalIndex).padStart(8),
    (globalHub - globalIndex >= 0 ? `+${globalHub - globalIndex}` : String(globalHub - globalIndex)).padStart(8),
    formatDelta(globalHub, globalIndex).pct.padStart(10),
    (globalOk ? 'yes' : 'NO').padStart(6)
  );

  if (verbose) {
    console.log('\nPer-tenant folder counts (hub vs index)');
    for (const tid of [...allTenantIds].sort()) {
      const label = tenantNames.get(tid) || tid;
      console.log(`\n  ${label} (${tid})`);
      console.log('  ', 'Folder'.padEnd(16), 'Hub'.padStart(8), 'Index'.padStart(8), 'OK'.padStart(6));
      for (const folder of FOLDER_KEYS) {
        const [hub, index] = await Promise.all([
          countFolderForTenant(PersonHubView, tid, folder),
          countFolderForTenant(PersonIndex, tid, folder),
        ]);
        const ok = withinTolerance(hub, index, FOLDER_PARITY_RATIO);
        if (!ok) driftFound = true;
        console.log(
          '  ',
          folder.padEnd(16),
          String(hub).padStart(8),
          String(index).padStart(8),
          (ok ? 'yes' : 'NO').padStart(6)
        );
      }
    }
  }

  console.log('\n[checkPersonHubParity] Summary');
  if (driftFound) {
    console.log('  DRIFT detected — run reconcileDataHub / backfillPersonIds before stopping dual-write.');
    console.log(`  Tolerance: hub within ${TOTAL_PARITY_RATIO * 100}% of index (same rule as folderCache).`);
  } else {
    console.log('  Parity OK — hub counts align with PersonIndex for all tenants checked.');
  }

  await mongoose.disconnect();
  process.exit(driftFound ? 1 : 0);
}

main().catch((err) => {
  console.error('[checkPersonHubParity] Failed:', err);
  process.exit(1);
});
