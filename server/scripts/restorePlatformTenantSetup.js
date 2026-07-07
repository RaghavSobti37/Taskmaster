/**
 * Restore TSC platform tenant flags after org consolidation (features + Clerk users).
 *
 *   node server/scripts/restorePlatformTenantSetup.js
 *   node server/scripts/restorePlatformTenantSetup.js --prod --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { ORG_FEATURE_KEYS } = require('../../shared/orgFeatures.cjs');

const BYPASS = { bypassTenant: true };
const useProd = process.argv.includes('--prod');
const dryRun = !process.argv.includes('--yes');

const allFeatureUnlocks = () => Object.fromEntries(ORG_FEATURE_KEYS.map((key) => [key, true]));

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  const label = useProd ? 'PROD' : 'LOCAL';
  const slug = String(process.env.PLATFORM_TENANT_SLUG || 'tsc').trim();

  const tenant = await Tenant.findOne({ slug }).setOptions(BYPASS);
  if (!tenant) throw new Error(`Tenant not found for slug "${slug}"`);

  console.log(`[${label}] ${dryRun ? 'DRY RUN' : 'EXECUTE'} — restore ${tenant.name} (${tenant._id})`);

  const unlocks = allFeatureUnlocks();
  const clerkUsers = await User.find({
    tenantId: tenant._id,
    clerkId: { $exists: true, $ne: null },
    mustChangePassword: true,
  }).setOptions(BYPASS).select('email').lean();

  console.log('featureUnlocks → all enabled:', unlocks);
  console.log(`clear mustChangePassword for ${clerkUsers.length} Clerk user(s)`);
  clerkUsers.forEach((u) => console.log(`  - ${u.email}`));

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  tenant.featureUnlocks = unlocks;
  if (tenant.onboardingProgress?.dismissedChecklist) {
    tenant.onboardingProgress.dismissedChecklist = false;
  }
  tenant.markModified('featureUnlocks');
  tenant.markModified('onboardingProgress');
  await tenant.save();

  const userFix = await User.updateMany(
    { tenantId: tenant._id, clerkId: { $exists: true, $ne: null } },
    { $set: { mustChangePassword: false } },
  ).setOptions(BYPASS);

  console.log(`Done. Clerk users updated: ${userFix.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
