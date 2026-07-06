/**
 * Delete a tenant and all documents with matching tenantId.
 * Usage:
 *   node server/scripts/deleteTenantCascade.js --slug rnd-website
 *   node server/scripts/deleteTenantCascade.js --id <mongoObjectId>
 *   node server/scripts/deleteTenantCascade.js --slug rnd-website --dry-run
 *   node server/scripts/deleteTenantCascade.js --slug rnd-website --prod
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { executeTenantCascadeDelete, deleteTenantData } = require('../services/tenantCascadeDeleteService');

const useProd = process.argv.includes('--prod');
const dryRun = process.argv.includes('--dry-run');
const BYPASS = { bypassTenant: true };
function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return '';
  return String(process.argv[idx + 1]).trim();
}

async function deleteTenantDataForScript(tenantId) {
  return deleteTenantData(tenantId, { dryRun });
}

async function main() {
  const slug = readArg('--slug');
  const id = readArg('--id');
  if (!slug && !id) {
    throw new Error('Provide --slug <slug> or --id <tenantObjectId>');
  }

  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);

  const tenant = id
    ? await Tenant.findById(id).setOptions(BYPASS)
    : await Tenant.findOne({ slug }).setOptions(BYPASS);
  if (!tenant) {
    throw new Error(`Tenant not found (${slug || id})`);
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Deleting tenant ${tenant.name} (${tenant.slug}) ${tenant._id}`);

  if (dryRun) {
    const { summary, membershipCount, inviteCount } = await deleteTenantDataForScript(tenant._id);
    summary.forEach((row) => console.log(`  ${row.collection}: ${row.deleted}`));
    console.log(`  tenantmemberships: ${membershipCount}`);
    console.log(`  tenantinvites: ${inviteCount}`);
  } else {
    const result = await executeTenantCascadeDelete(tenant._id, { deleteClerk: true });
    result.summary.forEach((row) => console.log(`  ${row.collection}: ${row.deleted}`));
    console.log(`  tenantmemberships: ${result.membershipCount}`);
    console.log(`  tenantinvites: ${result.inviteCount}`);
    console.log('Tenant row removed.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
