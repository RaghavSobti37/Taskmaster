#!/usr/bin/env node
/**
 * Remove test/QA emails from a Clerk organization.
 *
 * Usage:
 *   node server/scripts/pruneClerkOrgTestMembers.js
 *   node server/scripts/pruneClerkOrgTestMembers.js --org-id org_xxx --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkMigrationExcludedEmail } = require('../utils/clerkMigrationFilters');

const args = process.argv.slice(2);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
};
const dryRun = args.includes('--dry-run');
const orgId = readArg('--org-id') || process.env.CLERK_ORGANIZATION_ID || '';

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY required');
    process.exit(1);
  }
  if (!orgId) {
    console.error('Pass --org-id or set CLERK_ORGANIZATION_ID');
    process.exit(1);
  }

  const mem = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 200,
  });

  const actions = [];
  for (const entry of mem.data || []) {
    const userId = entry.publicUserData?.userId;
    if (!userId) continue;
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress || '';
    if (!isClerkMigrationExcludedEmail(email)) continue;
    actions.push({ userId, email, role: entry.role });
    if (!dryRun) {
      await clerkClient.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId,
      });
    }
  }

  console.log(JSON.stringify({ dryRun, orgId, removed: actions.length, actions }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
