#!/usr/bin/env node
/**
 * Link a CoreKnot tenant to a Clerk organization for domain + invite access control.
 *
 * Usage:
 *   node server/scripts/bootstrapClerkOrganization.js
 *   node server/scripts/bootstrapClerkOrganization.js --org-id org_xxx --slug theshakticollective --domain theshakticollective.in
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
};

const orgId = readArg('--org-id', process.env.CLERK_ORGANIZATION_ID || 'org_3FtSYDXVVjJQPtOg8LqhPYdeEdH');
const slug = readArg('--slug', process.env.PLATFORM_TENANT_SLUG || 'theshakticollective');
const allowedEmailDomain = readArg('--domain', process.env.ALLOWED_DOMAIN || 'theshakticollective.in');
const tenantName = readArg('--name', 'The Shakti Collective');
const contactEmail = readArg('--contact', `admin@${allowedEmailDomain}`);

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  if (!orgId) {
    console.error('Pass --org-id or set CLERK_ORGANIZATION_ID');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let tenant = await Tenant.findOne({ clerkOrganizationId: orgId }).setOptions({ bypassTenant: true });
  if (!tenant) {
    tenant = await Tenant.findOne({ slug }).setOptions({ bypassTenant: true });
  }
  if (!tenant) {
    tenant = await Tenant.findOne({ name: 'Default Tenant' }).setOptions({ bypassTenant: true });
  }

  if (tenant) {
    tenant.name = tenantName;
    tenant.slug = slug;
    tenant.clerkOrganizationId = orgId;
    tenant.allowedEmailDomain = allowedEmailDomain;
    tenant.contactEmail = tenant.contactEmail || contactEmail;
    tenant.status = 'active';
    tenant.updatedAt = new Date();
    await tenant.save();
  } else {
    tenant = await Tenant.create({
      name: tenantName,
      slug,
      clerkOrganizationId: orgId,
      allowedEmailDomain,
      contactEmail,
      status: 'active',
    });
  }

  console.log(JSON.stringify({
    tenantId: String(tenant._id),
    slug: tenant.slug,
    clerkOrganizationId: tenant.clerkOrganizationId,
    allowedEmailDomain: tenant.allowedEmailDomain,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
