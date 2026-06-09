/**
 * Assign open booked-call / artist booking leads to Akash.
 * Run: node server/scripts/reassignBookedCallsToAkash.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { BOOKED_CALL_SOURCE_RE } = require('../../shared/dataInlets');
const { resolvePrimaryCallAssigneeId } = require('../utils/primaryCallAssignee');
const { CRM_TYPES, CONTACT_CATEGORIES } = require('../../shared/artistCrmTaxonomy');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const akashId = await resolvePrimaryCallAssigneeId();
  if (!akashId) throw new Error('Could not resolve Akash (PRIMARY_CALL_ASSIGNEE)');

  const filter = {
    leadStatus: { $ne: 'Converted' },
    $or: [
      { source: { $regex: BOOKED_CALL_SOURCE_RE.source, $options: 'i' } },
      { contactCategory: CONTACT_CATEGORIES.BOOKING_ENQUIRY, crmType: CRM_TYPES.ARTIST },
    ],
  };

  const count = await Lead.countDocuments(filter).setOptions({ bypassTenant: true });
  console.log(`Found ${count} booked-call / artist-booking leads to assign to Akash (${akashId})`);

  if (!dryRun && count > 0) {
    const result = await Lead.updateMany(
      filter,
      { $set: { assignedRepId: akashId } },
      { bypassTenant: true }
    );
    console.log(`Updated ${result.modifiedCount} leads`);
  } else if (dryRun) {
    console.log('Dry run — no changes written');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
