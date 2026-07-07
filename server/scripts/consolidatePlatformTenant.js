/**
 * Keep one platform tenant, rename slug, cascade-delete the rest.
 *
 *   node server/scripts/consolidatePlatformTenant.js --new-slug tsc --keep-slug theshakticollective
 *   node server/scripts/consolidatePlatformTenant.js --new-slug tsc --keep-slug theshakticollective --prod --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { executeTenantCascadeDelete } = require('../services/tenantCascadeDeleteService');
const { isClerkConfigured } = require('../utils/clerkAuth');

const BYPASS = { bypassTenant: true };

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return '';
  return String(process.argv[idx + 1]).trim();
}

const useProd = process.argv.includes('--prod');
const dryRun = !process.argv.includes('--yes');
const newSlug = readArg('--new-slug') || 'tsc';
const keepSlug = readArg('--keep-slug') || 'theshakticollective';

async function updateClerkOrgSlug(clerkOrganizationId, slug) {
  if (!isClerkConfigured() || !clerkOrganizationId) {
    return { updated: false, reason: 'not_configured' };
  }
  const { clerkClient } = require('@clerk/clerk-sdk-node');
  try {
    await clerkClient.organizations.updateOrganization(clerkOrganizationId, { slug });
    return { updated: true };
  } catch (err) {
    const message = String(err?.errors?.[0]?.message || err?.message || 'Clerk org update failed');
    return { updated: false, reason: message };
  }
}

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  const label = useProd ? 'PROD' : 'LOCAL';
  console.log(`[${label}] ${dryRun ? 'DRY RUN' : 'EXECUTE'} — keep slug "${keepSlug}" → "${newSlug}"`);

  const keep = await Tenant.findOne({ slug: keepSlug }).setOptions(BYPASS);
  if (!keep) {
    throw new Error(`Keep tenant not found for slug "${keepSlug}"`);
  }

  const others = await Tenant.find({ _id: { $ne: keep._id } }).setOptions(BYPASS).lean();
  console.log(`Keep: ${keep.name} (${keep._id})`);
  console.log(`Remove: ${others.length} tenant(s)`);
  others.forEach((t) => console.log(`  - ${t.name} (${t.slug || 'no-slug'}) ${t._id}`));

  if (dryRun) {
    const taken = await Tenant.findOne({ slug: newSlug, _id: { $ne: keep._id } }).setOptions(BYPASS);
    if (taken) console.warn(`WARN: slug "${newSlug}" already used by ${taken.name}`);
    await mongoose.disconnect();
    return;
  }

  for (const row of others) {
    console.log(`Deleting ${row.name}...`);
    // eslint-disable-next-line no-await-in-loop
    await executeTenantCascadeDelete(row._id, { deleteClerk: true });
  }

  const userFix = await User.updateMany(
    { tenantId: { $ne: keep._id } },
    { $set: { tenantId: keep._id } },
  ).setOptions(BYPASS);
  console.log(`Users reassigned to keep tenant: ${userFix.modifiedCount}`);

  keep.slug = newSlug;
  keep.updatedAt = new Date();
  await keep.save();

  const clerk = await updateClerkOrgSlug(keep.clerkOrganizationId, newSlug);
  console.log(`Clerk slug update: ${JSON.stringify(clerk)}`);
  console.log(`Done. Sole tenant: ${keep.name} slug=${newSlug} id=${keep._id}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
